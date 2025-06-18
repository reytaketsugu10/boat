console.log("upload.js 読み込み完了");

// OAuth認証用スコープ
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let selectedFiles = [];

const fileElem = document.getElementById('fileElem');
const dropArea = document.getElementById('drop-area');
const uploadBtn = document.getElementById('uploadBtn');

// ファイル選択時
fileElem.addEventListener('change', handleFileSelect);
uploadBtn.addEventListener('click', handleUpload);

// ドラッグ＆ドロップ対応
['dragenter', 'dragover'].forEach(eventName => {
  dropArea.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropArea.classList.add('highlight');
  }, false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropArea.classList.remove('highlight');
  }, false);
});

dropArea.addEventListener('drop', (e) => {
  e.preventDefault();
  const dt = e.dataTransfer;
  const files = dt.files;

  const dataTransfer = new DataTransfer();
  for (let file of files) {
    if (file.type === "application/pdf") {
      dataTransfer.items.add(file);
    }
  }

  fileElem.files = dataTransfer.files;
  handleFileSelect({ target: fileElem });
});

// Google API 読み込み後
function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}
window.gapiLoaded = gapiLoaded;

// Google Identity 読み込み後
function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: '', // 後で設定
  });
  gisInited = true;
}
window.gisLoaded = gisLoaded;

// GAPI初期化
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

// 認証完了後にボタン有効化
function maybeEnableUpload() {
  if (gapiInited && gisInited) {
    uploadBtn.disabled = false;
  }
}

// ファイル選択処理
function handleFileSelect(event) {
  selectedFiles = Array.from(event.target.files);
  console.log("選択されたファイル:", selectedFiles.map(f => f.name));
}

// ファイル名からタイトル（競艇場）を推定
function extractTitleFromFilename(filename) {
  for (const title in folderMap) {
    if (filename.includes(title)) {
      return title;
    }
  }
  return null;
}

// アップロード処理本体
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
    fileElem.value = '';
  };

  tokenClient.requestAccessToken({ prompt: 'consent' });
}
// グローバルで呼び出せるように登録
window.gapiLoaded = gapiLoaded;
window.gisLoaded = gisLoaded;

