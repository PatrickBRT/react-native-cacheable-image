import { Worker, WorkerQueue } from './workerQueue';

import RNFS, { DocumentDirectoryPath } from 'react-native-fs';

_workerQueue = new WorkerQueue();

export default WorkerAwareRNFS  = {

  constructor() {
    this._callAsWorker = this._callAsWorker.bind(this);
    this.exists = this.exists.bind(this);
    this.stat = this.stat.bind(this);
    this.unlink = this.unlink.bind(this);
    this.moveFile = this.moveFile.bind(this);
    this.downloadFile = this.downloadFile.bind(this);
    this.deleteFileIfPresent = this.deleteFileIfPresent.bind(this);
  },

  _callAsWorker(id: string, operation: string, action: Function, ...params) {
    const worker = new Worker(id, operation, action, params);
    return _workerQueue.addWorker(worker);
  },

  exists (filePath) {
    return this._callAsWorker(filePath, 'exists', RNFS.exists, filePath);
  },

  unlink(filePath) {
   return this._callAsWorker(filePath, 'unlink', RNFS.unlink, filePath);
  },

  stat(filePath) {
    return this._callAsWorker(filePath, 'state', RNFS.stat, filePath);
  },

  mkdir(dirPath, parameter) {
    return this._callAsWorker(dirPath, 'mkdir', RNFS.mkdir, dirPath, parameter);
  },

  downloadFile(downloadOptions) {
    return this._callAsWorker(downloadOptions.fromUrl, 'downloadFile', RNFS.downloadFile, downloadOptions);
  },

  copyFile(oldFilePath, newFilePath) {
    return this._callAsWorker(oldFilePath+'_'+newFilePath, 'copyFile', RNFS.copyFile, oldFilePath, newFilePath);
  },

  moveFile(oldFilePath, newFilePath) {
    return this._callAsWorker(oldFilePath+'_'+newFilePath, 'moveFile', RNFS.moveFile, oldFilePath, newFilePath);
  },

  deleteIfFileExists(filePath) {
    return this._callAsWorker(filePath, 'deleteIfFileExists', (filePath) => {
      this.exists(filePath).then((exists) => {
        if (exists) {
          this.unlink(filePath);
        }
      }).catch((err) => { console.log(err); })
    }, filePath);
  },
}