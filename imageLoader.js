import RNFS, { DocumentDirectoryPath } from 'react-native-fs';
import { AsyncStorage } from 'react-native';
import { get } from 'lodash';

import WorkerAwareRNFS from './workerAwareRNFS';
const cachePath = 'runtastic';

export class ImageLoader {
  constructor() {
    this._downloadFile = this._downloadFile.bind(this);
    this._moveFile = this._moveFile.bind(this);
    this.load = this.load.bind(this);
  }

  _moveFile(oldFilePath, newFilePath) {
    return new Promise(function(resolve, reject) {
      WorkerAwareRNFS.deleteIfFileExists(newFilePath).then(() => {
        WorkerAwareRNFS.moveFile(oldFilePath, newFilePath).then(()=>{
          resolve(newFilePath);
        }).catch((err) => { reject(err); });
      }).catch((err) => { reject(err); });
    });
  }

  _downloadFile(imageUri, dirPath, filePath) {
    // directory exists.. begin download
    const that = this;
    let fileType = null;
    let downloadOptions = {
      fromUrl: imageUri,
      toFile: filePath,
      background: true,
      begin: (info: DownloadBeginCallbackResult) => {
        const contentType = get(info, ['headers', 'Content-Type']);
        fileType = contentType.substring(contentType.lastIndexOf('/')+1);
        AsyncStorage.setItem('@Store:'+imageUri,fileType);
      }
    };

    const promiseToWaitFor = new Promise(function(resolve, reject) {
    //  WorkerAwareRNFS.mkdir(dirPath, {NSURLIsExcludedFromBackupKey: true}).then(() => {
        return WorkerAwareRNFS.downloadFile(downloadOptions).then((downloadObject) => {
          downloadObject.promise.then(() => {
            AsyncStorage.getItem('@Store:'+imageUri).then((fileType) => {
              resolve({
                filePath: downloadOptions.toFile,
                suffix:  fileType,
              });
            });
          });
      }).catch((err) => {
        console.log(err);
      })
    });

    return promiseToWaitFor;
  }

  load(imageUri, cacheKey) {
    const dirPath = DocumentDirectoryPath+'/'+cachePath;
    const filePath = dirPath+'/'+cacheKey;

    const promiseToWaitFor = new Promise((resolve, reject) => {
      this._downloadFile(imageUri, dirPath, filePath).then(({filePath, suffix}) => {
        console.log('√ downloaded to ' + filePath);

        const newFilePath = filePath + '.' + suffix;
        this._moveFile(filePath, newFilePath).then(() => {
          console.log('√ moved file');
          resolve(newFilePath);
        })
      })
    });
    return promiseToWaitFor;
  }
}