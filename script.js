const fileInput = document.getElementById('fileInput');
const progressBar = document.getElementById('progressBar');
const messageDiv = document.getElementById('message');
const chunkSize = 1024 * 1024; // 1MB per chunk
const uploadChunkURL = 'http://127.0.0.1:1234/upload/chunk';
const mergeChunksURL = 'http://127.0.0.1:1234/upload/merge';

let file;
let totalChunks;
let uploadId;

fileInput.addEventListener('change', (event) => {
      file = event.target.files[0];
      if (file) {
            totalChunks = Math.ceil(file.size / chunkSize);
            uploadId = null;
            progressBar.style.width = '0%';
            messageDiv.innerText = `File dipilih: ${file.name} (${formatBytes(file.size)}), Total Chunks: ${totalChunks}`;
      } else {
            messageDiv.innerText = 'Tidak ada file yang dipilih.';
            progressBar.style.width = '0%';
            file = null;
            totalChunks = 0;
      }
});

async function uploadChunk(chunk, index) {
      const formData = new FormData();
      formData.append('chunk', chunk);
      formData.append('chunkIndex', index);
      formData.append('totalChunks', totalChunks);
      formData.append('uploadId', uploadId); // uploadId diambil dari scope luar (dibuat di startUpload)

      // console.log(`Mengirim chunk ${index + 1}/${totalChunks} dengan uploadId: ${uploadId}`); // Untuk debug

      try {
            const response = await fetch(uploadChunkURL, {
                  method: 'POST',
                  body: formData,
            });

            if (!response.ok) {
                  let errorMessage = `HTTP error! status: ${response.status}`;
                  try {
                        const errorData = await response.json();
                        if (errorData && errorData.message) {
                              errorMessage = errorData.message;
                        } else if (response.statusText) {
                              errorMessage = response.statusText;
                        } else {
                              errorMessage = `Server returned status ${response.status}`;
                        }
                  } catch (e) { // Gagal parse JSON error
                        errorMessage = response.statusText || `Server returned status ${response.status} with non-JSON body`;
                  }
                  // Tambahkan info chunk ke pesan error agar lebih jelas saat muncul di startUpload
                  throw new Error(`Gagal pada chunk ${index + 1} dari ${totalChunks}: ${errorMessage}`);
            }

            const data = await response.json(); // Backend diharapkan mengembalikan JSON
            // Pesan dan progress bar tidak lagi diupdate per chunk di sini,
            // akan dihandle oleh startUpload setelah chunk ini resolve.
            return data; // Mengembalikan data dari server (misal: data.uploadId atau konfirmasi)
      } catch (error) {
            console.error(`Error mengunggah chunk ${index + 1}:`, error.message);
            throw error; // Lempar ulang error agar Promise.all di startUpload bisa menangkapnya
      }
}

async function mergeChunks() {
      const formData = new FormData();
      formData.append('uploadId', uploadId);
      formData.append('filename', file.name);

      messageDiv.innerText = 'Menggabungkan chunk...';

      try {
            const response = await fetch(mergeChunksURL, {
                  method: 'POST',
                  body: formData,
            });

            if (!response.ok) {
                  let errorMessage = `HTTP error! status: ${response.status}`;
                  try {
                        const errorData = await response.json();
                        if (errorData && errorData.message) {
                              errorMessage = errorData.message;
                        } else if (response.statusText) {
                              errorMessage = response.statusText;
                        }
                  } catch (e) {
                        // biarkan errorMessage default jika parse gagal
                  }
                  throw new Error(errorMessage);
            }

            const data = await response.json();
            messageDiv.innerText = `Upload selesai! File: ${data.fileName}, URL: ${data.signedURL}`;
            console.log('Upload berhasil:', data);

            // Reset state
            uploadId = null;
            progressBar.style.width = '0%';
            fileInput.value = '';
            file = null;
            totalChunks = 0;
      } catch (error) {
            messageDiv.innerText = `Gagal menggabungkan chunk: ${error.message}`;
            console.error('Error merging chunks:', error);
      }
}

async function startUpload() {
      if (!file) {
            messageDiv.innerText = 'Pilih file terlebih dahulu.';
            return;
      }

      if (!uploadId) {
            uploadId = generateUniqueId();
      }

      progressBar.style.width = '0%';
      messageDiv.innerText = `Menyiapkan unggahan untuk ${totalChunks} chunk... (Upload ID: ${uploadId})`;

      let completedChunks = 0;
      const chunkPromises = [];

      for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min((i + 1) * chunkSize, file.size);
            const chunk = file.slice(start, end);

            chunkPromises.push(
                  uploadChunk(chunk, i)
                        .then(serverDataOfChunk => {
                              completedChunks++;
                              const progress = (completedChunks / totalChunks) * 100;
                              progressBar.style.width = `${progress}%`;
                              messageDiv.innerText = `Proses unggah: ${completedChunks} dari ${totalChunks} chunk selesai. (Upload ID: ${uploadId})`;
                              // console.log(`Chunk ${i + 1} berhasil diunggah. Data server:`, serverDataOfChunk);
                              return serverDataOfChunk;
                        })
                  // Tidak perlu .catch() di sini, biarkan Promise.all yang menangani kegagalan
            );
      }

      try {
            await Promise.all(chunkPromises);

            messageDiv.innerText = 'Semua chunk berhasil diunggah. Memulai proses penggabungan...';
            await mergeChunks();
      } catch (error) {
            messageDiv.innerText = `${error.message}`;
            console.error('Gagal mengunggah satu atau lebih chunk:', error);

      }
}

function generateUniqueId() {
      return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function formatBytes(bytes, decimals = 2) {
      if (!+bytes) return '0 Bytes';
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
