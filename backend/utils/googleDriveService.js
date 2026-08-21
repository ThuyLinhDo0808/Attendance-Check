const { google } = require('googleapis');
const fs = require('fs');

// Lấy 3 chìa khóa từ file .env
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

// Khởi tạo OAuth2 Client thay vì dùng Service Account
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const driveService = google.drive({ version: 'v3', auth: oauth2Client });

const getOrCreateEmployeeFolder = async (employeeCode, parentFolderId) => {
    const query = `mimeType='application/vnd.google-apps.folder' and name='${employeeCode}' and '${parentFolderId}' in parents and trashed=false`;
    const res = await driveService.files.list({ q: query, fields: 'files(id, name)' });

    if (res.data.files.length > 0) return res.data.files[0].id;

    const folderMetadata = {
        name: employeeCode,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
    };
    
    const folder = await driveService.files.create({
        resource: folderMetadata,
        fields: 'id'
    });

    await driveService.permissions.create({
        fileId: folder.data.id,
        requestBody: { role: 'reader', type: 'anyone' }
    });

    return folder.data.id;
};

const uploadFileToDrive = async (filePath, fileName, targetFolderId) => {
    const fileMetadata = { 'name': fileName, 'parents': [targetFolderId] };
    const mimeType = fileName.match(/\.(jpg|jpeg|png)$/i) ? 'image/jpeg' : 'video/mp4';
    
    const media = { mimeType: mimeType, body: fs.createReadStream(filePath) };

    const response = await driveService.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id'
    });

    await driveService.permissions.create({
        fileId: response.data.id,
        requestBody: { role: 'reader', type: 'anyone' }
    });

    return response.data.id;
};

module.exports = { getOrCreateEmployeeFolder, uploadFileToDrive };