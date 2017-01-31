import React from 'react';
import { get, find, remove } from '../lodash/'
import { Image, AsyncStorage, ActivityIndicator, NetInfo } from 'react-native';
import RNFS, { DocumentDirectoryPath } from 'react-native-fs';
import ResponsiveImage from 'react-native-responsive-image';

import { Worker, WorkerQueue } from './workerQueue';
import WorkerAwareRNFS from './workerAwareRNFS';

import { ImageStore } from './imageStore';

const SHA1 = require("crypto-js/sha1");
const URL = require('url-parse');

const cachePath = 'runtastic';

export default class CacheableImage extends React.Component {
    _checkForFilePathAndDeleteIfPresent: Function;
    _workerQueue: WorkerQueue;
    _imageStore: ImageStore;

    constructor(props) {
        super(props)

        _workerQueue = new WorkerQueue();
        _imageStore = new ImageStore();

        this._callAsWorker = this._callAsWorker.bind(this);
        this._isFileInCache = this._isFileInCache.bind(this);
        this._copyFileWithSuffix = this._copyFileWithSuffix.bind(this);
        this._getCacheKeyForUrl = this._getCacheKeyForUrl.bind(this);
        this.deleteFromCache = this.deleteFromCache.bind(this);

        this._handleConnectivityChange = this._handleConnectivityChange.bind(this);

        this.state = {
            isRemote: false,
            cachedImagePath: null,
            cacheable: true,
            jobId: null,
            networkAvailable: false
        };
    };

    componentWillReceiveProps(nextProps) {
        if (nextProps.source != this.props.source) {
            this._processSource(nextProps.source);
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (nextState === this.state && nextProps === this.props) {
            return false;
        }
        return true;
    }

    _callAsWorker(id: string, operation: string, action: Function, ...params) {
      const worker = new Worker(id, operation, action, params);
      return _workerQueue.addWorker(worker);
    }

    _isFileInCache(filePath) {
      console.log('? file='+filePath)
      const that = this;
      return new Promise(function(resolve, reject) {
        WorkerAwareRNFS.stat(filePath).then((res) => {
          if (res.isFile()) {
              resolve({
                isInCache: true,
                modifiedTimestamp: res.mtime
              });
          }
        })
        .catch((err) => {
          resolve({isInCache: false});
        });
      });
    }


  _copyFileWithSuffix(oldFilePath, suffix) {
    const newFilePath = `${oldFilePath}.${suffix}`
    // using that because "this" is a different "this" inside the promise
    return new Promise(function(resolve, reject) {
      WorkerAwareRNFS.deleteIfFileExists(newFilePath).then(() => {
        WorkerAwareRNFS.copyFile(oldFilePath, newFilePath).then(()=>{
          resolve(newFilePath);
        }).catch((err) => { reject(err)});
      })
        .catch((err) => { reject(err)});
    });
  }

    async deleteFromCache(imageUri) {
      const cacheKey = this._getCacheKeyForUrl(new URL(imageUri, null, true));
      const dirPath = DocumentDirectoryPath+'/'+cachePath;
      const filePath = dirPath+'/'+cacheKey;

      return this._checkForFilePathAndDeleteIfPresent(filePath);
    }



    async checkImageCache(imageUri, cacheKey) {
      const dirPath = DocumentDirectoryPath+'/'+cachePath;
      const filePath = dirPath+'/'+cacheKey;

      // check if we know something about this file
      _imageStore.get(cacheKey).then((value) => {
        if (value != null) {
          this.setState({ cacheable: true, cachedImagePath: value});
        } else {
          console.log('caching '+imageUri);
          _imageStore.put(imageUri).then((newImagePath) => {
            console.log(newImagePath);
            this.setState({ cacheable: true, cachedImagePath: newImagePath});
          })
        }
    });

    }

    _getCacheKeyForUrl(url: Url) {
      return SHA1(url.pathname);
    }

    _processSource(source) {
        if (source != null
		        && source !== ''
            && typeof source === 'object'
            && source.hasOwnProperty('uri')) {
            const url = new URL(source.uri, null, true);

            const cacheKey = this._getCacheKeyForUrl(url);

            this.checkImageCache(source.uri, cacheKey);
            this.setState({isRemote: true});
        }
        else {
            this.setState({isRemote: false});
        }
    }

    componentWillMount() {
        NetInfo.isConnected.addEventListener('change', this._handleConnectivityChange);
        // initial
        NetInfo.isConnected.fetch().then(isConnected => {
          this.setState({networkAvailable: isConnected});
    		});

        this._processSource(this.props.source);
    }

    componentWillUnmount() {
        NetInfo.isConnected.removeEventListener('change', this._handleConnectivityChange);

        if (this.state.downloading && this.state.jobId) {
            RNFS.stopDownload(this.state.jobId);
        }
    }

    async _handleConnectivityChange(isConnected) {
	    this.setState({
            networkAvailable: isConnected,
	    });
    };

    render() {
        if (this.state.cacheable && this.state.cachedImagePath) {
            return this.renderCache();
        }

        return (
            <ActivityIndicator {...this.props.activityIndicatorProps} />
        );
    }

    renderCache() {
        const { children, defaultSource, activityIndicatorProps, ...props } = this.props;

        return (
          <Image {...props} source={{uri: 'file://'+this.state.cachedImagePath}}>
            {children}
          </Image>
        );
    }
}

CacheableImage.propTypes = {
    activityIndicatorProps: React.PropTypes.object,
    defaultSource: Image.propTypes.source,
    useQueryParamsInCacheKey: React.PropTypes.oneOfType([
        React.PropTypes.bool,
        React.PropTypes.array
    ])
};


CacheableImage.defaultProps = {
    style: { backgroundColor: 'transparent' },
    activityIndicatorProps: {
        style: { backgroundColor: 'transparent', flex: 1 }
    },
    useQueryParamsInCacheKey: false // bc
};
