const { google } = require('googleapis');
const fs = require('fs');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
const driveService = google.drive({ version: 'v3', auth: oauth2Client });

const uploadFileToDrive = async (filePath, fileName, targetFolderId) => {
    const fileMetadata = { 'name': fileName, 'parents': [targetFolderId] };
    const mimeType = fileName.match(/\.(jpg|jpeg|png)$/i) ? 'image/jpeg' : 'video/mp4';
    const media = { mimeType: mimeType, body: fs.createReadStream(filePath) };

    const response = await driveService.files.create({
        resource: fileMetadata, media: media, fields: 'id'
    });

    await driveService.permissions.create({
        fileId: response.data.id, requestBody: { role: 'reader', type: 'anyone' }
    });
    return response.data.id;
};

module.exports = { uploadFileToDrive };