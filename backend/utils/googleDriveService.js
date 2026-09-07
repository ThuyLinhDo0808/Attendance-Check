const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
const driveService = google.drive({ version: 'v3', auth: oauth2Client });

const uploadFileToDrive = async (filePath, fileName, targetFolderId) => {
    const fileMetadata = { 'name': fileName, 'parents': [targetFolderId] };
    
    let mimeType = 'application/octet-stream';
    if (fileName.match(/\.(jpg|jpeg|png)$/i)) mimeType = 'image/jpeg';
    else if (fileName.match(/\.(mp4|mov|avi)$/i)) mimeType = 'video/mp4';
    else if (fileName.match(/\.zip$/i)) mimeType = 'application/zip';

    const media = { mimeType: mimeType, body: fs.createReadStream(filePath) };

    const response = await driveService.files.create({
        resource: fileMetadata, media: media, fields: 'id'
    });

    await driveService.permissions.create({
        fileId: response.data.id, requestBody: { role: 'reader', type: 'anyone' }
    });
    return response.data.id;
};

/**
 * Xóa nhiều file trên Google Drive thông qua mảng fileIds
 */
const deleteDriveFiles = async (fileIdsArray) => {
    for (const fileId of fileIdsArray) {
        try {
            await driveService.files.delete({ fileId: fileId });
            console.log(`Deleted file from Drive: ${fileId}`);
        } catch (error) {
            console.error(`Error occurred while deleting file ${fileId}:`, error.message);
        }
    }
};

/**
 * Tự động tải các file từ Google Drive theo ID, gom vào 1 file ZIP
 * Sau đó Upload file ZIP này lên Drive và xóa file ZIP cục bộ.
 */
const zipAndUploadToDrive = async (fileIdsArray, zipFileName, targetFolderId) => {
    return new Promise((resolve, reject) => {
        // Tạo đường dẫn file zip lưu tạm thời trên Server
        const zipFilePath = path.join(__dirname, '..', 'uploads', zipFileName);
        const output = fs.createWriteStream(zipFilePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', async () => {
            console.log(`Finished archiving ${archive.pointer()} bytes. Starting upload of ZIP to Drive...`);
            try {
                // Tải file ZIP đã nén lên Google Drive
                const uploadedZipId = await uploadFileToDrive(zipFilePath, zipFileName, targetFolderId);
                
                // Xóa file ZIP cục bộ trên server để đỡ nặng máy
                if (fs.existsSync(zipFilePath)) {
                    fs.unlinkSync(zipFilePath); 
                }
                resolve(uploadedZipId);
            } catch (err) {
                reject(err);
            }
        });

        archive.on('error', (err) => {
            reject(err);
        });

        archive.pipe(output);

        // Hàm helper tải từng file và đẩy vào Archive (chạy tuần tự để tránh quá tải RAM)
        const downloadAndAppend = (fileId) => {
            return new Promise(async (resolveApp, rejectApp) => {
                try {
                    // Lấy tên file gốc
                    const meta = await driveService.files.get({ fileId: fileId, fields: 'name' });
                    const fileName = meta.data.name;

                    // Stream data từ Google Drive
                    const response = await driveService.files.get(
                        { fileId: fileId, alt: 'media' },
                        { responseType: 'stream' }
                    );

                    archive.append(response.data, { name: fileName });

                    // Đợi stream của file này đọc xong mới chuyển sang file tiếp theo
                    response.data.on('end', () => resolveApp());
                    response.data.on('error', (err) => rejectApp(err));
                } catch (err) {
                    console.error(`Error occurred while downloading file ${fileId}:`, err.message);
                    resolveApp(); // Bỏ qua lỗi và tải file tiếp theo
                }
            });
        };

        const processAllFiles = async () => {
            for (const fileId of fileIdsArray) {
                await downloadAndAppend(fileId);
            }
            archive.finalize(); // Kích hoạt sự kiện 'close' ở trên
        };

        processAllFiles().catch(reject);
    });
};

/**
 * Tìm thư mục theo tên (VD: T9/2026) trong thư mục gốc, nếu chưa có thì tạo mới.
 */
const getOrCreateFolder = async (folderName, parentFolderId) => {
    const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentFolderId}' in parents and trashed=false`;
    const response = await driveService.files.list({
        q: query,
        fields: 'files(id, name)',
    });

    if (response.data.files.length > 0) {
        return response.data.files[0].id; // Trả về ID nếu thư mục đã tồn tại
    }

    // Nếu chưa tồn tại thì tạo mới
    const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
    };
    const folder = await driveService.files.create({
        resource: fileMetadata,
        fields: 'id'
    });
    
    // Cấp quyền đọc công khai (tuỳ chọn)
    await driveService.permissions.create({
        fileId: folder.data.id, requestBody: { role: 'reader', type: 'anyone' }
    });

    return folder.data.id;
};

/**
 * Lấy tất cả ID của các file (không phải thư mục) nằm trong một thư mục cụ thể.
 */
const getFilesInFolder = async (folderId) => {
    const query = `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed=false`;
    const response = await driveService.files.list({
        q: query,
        fields: 'files(id, name)'
    });
    return response.data.files.map(f => f.id);
};

module.exports = { 
    uploadFileToDrive, 
    deleteDriveFiles, 
    zipAndUploadToDrive,
    getOrCreateFolder,
    getFilesInFolder
};