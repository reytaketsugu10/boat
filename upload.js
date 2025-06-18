console.log("upload.js 読み込み完了");

const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets';
let tokenClient;
let gapiInited = false;
let gisInited = false;
let selectedFiles = [];

document.getElementById('fileElem').addEventListener('change', handleFileSelect);
document.getElementById('uploadBtn').addEventListener('click', handleUpload);

// Load the Google API client
function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}
window.gapiLoaded = gapiLoaded;

// Load the Google Identity Services client
function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: '', // will set later
  });
  gisInited = true;
}
window.gisLoaded = gisLoaded;

async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: apiKey,
    discoveryDocs: [
      'https://sheets.googleapis.com/$discovery/rest?version=v4',
      'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
    ],
  });
  gapiInited = true;
  maybeEnableUpload();
}

function maybeEnableUpload() {
  if (gapiInited && gisInited) {
    document.getElementById('uploadBtn').disabled = false;
  }
}

function handleFileSelect(event) {
  selectedFiles = Array.from(event.target.files);
}

function extractTitleFromFilename(filename) {
  for (const title in folderMap) {
    if (filename.includes(title)) {
      return title;
    }
  }
  return null;
}

async function handleUpload() {
  if (!selectedFiles.length) return alert("ファイルを選択してください");

  tokenClient.callback = async (resp) => {
    if (resp.error) throw resp;

    for (const file of selectedFiles) {
      const title = extractTitleFromFilename(file.name);
      if (!title || !folderMap[title]) {
        alert(`対応するタイトルが見つかりません: ${file.name}`);
        continue;
      }

      const metadata = {
        name: file.name,
        parents: [folderMap[title]],
        mimeType: 'application/pdf'
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({ Authorization: `Bearer ${gapi.auth.getToken().access_token}` }),
        body: form,
      });

      const uploadedFile = await uploadRes.json();
      const now = new Date().toISOString();

      await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        range: 'A:D',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [[title, file.name, uploadedFile.id, now]]
        }
      });

      alert(`アップロード完了: ${file.name}`);
    }

    selectedFiles = [];
    document.getElementById('fileElem').value = '';
  };

  tokenClient.requestAccessToken({ prompt: 'consent' });
}
