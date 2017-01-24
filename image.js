import React from 'react';
import { get } from '../lodash/'
import { Image, ActivityIndicator, NetInfo } from 'react-native';
import RNFS, { DocumentDirectoryPath } from 'react-native-fs';
import ResponsiveImage from 'react-native-responsive-image';

const SHA1 = require("crypto-js/sha1");
const URL = require('url-parse');

export default class CacheableImage extends React.Component {

    constructor(props) {
        super(props)
        this.imageDownloadBegin = this.imageDownloadBegin.bind(this);
        this._checkForFilePathAndDeleteIfPresent = this._checkForFilePathAndDeleteIfPresent.bind(this);
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

    async imageDownloadBegin(info) {
        const contentType = get(info,['headers', 'Content-Type']);
        _fileType = contentType.substring(contentType.lastIndexOf('/')+1);
    }

    async _checkForFilePathAndDeleteIfPresent(filePath) {
      return RNFS.exists(filePath).then((exists) => {
        let promiseToWaitFor = null;
        if (exists) {
          promiseToWaitFor = RNFS.unlink(filePath);
        } else {
          promiseToWaitFor = Promise.resolve();
        }
        return promiseToWaitFor;
      });
    }


    async checkImageCache(imageUri, cachePath, cacheKey) {
        const dirPath = DocumentDirectoryPath+'/'+cachePath;
        const filePath = dirPath+'/'+cacheKey;
        console.log('>> '+filePath);
        RNFS.stat(filePath).then((res) => {
          throw new Error();
            if (res.isFile()) {
                // means file exists, ie, cache-hit
                console.log('cache hit!');
                this.setState({cacheable: true, cachedImagePath: filePath});
            }
        })
        .catch((err) => {
            // means file does not exist
            // first make sure network is available..
            if (! this.state.networkAvailable) {
                this.setState({cacheable: false, cachedImagePath: null});
                return;
            }

            // then make sure directory exists.. then begin download
            // The NSURLIsExcludedFromBackupKey property can be provided to set this attribute on iOS platforms.
            // Apple will reject apps for storing offline cache data that does not have this attribute.
            // https://github.com/johanneslumpe/react-native-fs#mkdirfilepath-string-options-mkdiroptions-promisevoid
            RNFS.mkdir(dirPath, {NSURLIsExcludedFromBackupKey: true}).then(() => {
                // before we change the cachedImagePath.. if the previous cachedImagePath was set.. remove it
                if (this.state.cacheable && this.state.cachedImagePath) {
                    let delImagePath = this.state.cachedImagePath;
                    this._checkForFilePathAndDeleteIfPresent(delImagePath);
                }

                let downloadOptions = {
                    fromUrl: imageUri,
                    toFile: filePath,
                    background: true,
                    begin: this.imageDownloadBegin,
                };

                // directory exists.. begin download
                console.log('- downloading '+imageUri);
                RNFS.downloadFile(downloadOptions).promise.then((result) => {
                    const oldFilePath = filePath;
                    const newFilePath = filePath+'.'+_fileType;
                    console.log('√ download');

                    this._checkForFileAndDeleteIfPresent(newFilePath).then(() => {
                      RNFS.copyFile(oldFilePath, newFilePath).then(()=>{
                      console.log(oldFilePath+'/'+newFilePath);
                      this.setState({cacheable: true, cachedImagePath: newFilePath});
                    })
                  })
                  .catch((err) => {
                    console.log('x download');
                  })
                })
                .catch((err) => {
                    console.log(err);  // error occurred while downloading or download stopped.. remove file if created
                    this._checkForFilePathAndDeleteIfPresent(filePath);
                    this.setState({cacheable: false, cachedImagePath: null});
                });
            })
            .catch((err) => {
                this._checkForFilePathAndDeleteIfPresent(filePath);
                this.setState({cacheable: false, cachedImagePath: null});
            })
        });
    }

    _processSource(source) {
        if (source != null
		        && source !== ''
            && typeof source === 'object'
            && source.hasOwnProperty('uri')) {
            const url = new URL(source.uri, null, true);

            const cacheKey = SHA1(url.pathname);

            this.checkImageCache(source.uri, 'runtastic', cacheKey);
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
        if (!this.state.isRemote) {
            return this.renderLocal();
        }

        if (this.state.cacheable && this.state.cachedImagePath) {
            return this.renderCache();
        }

        if (this.props.defaultSource) {
            return this.renderDefaultSource();
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

    renderLocal() {
        const { children, defaultSource, activityIndicatorProps, ...props } = this.props;
        return (
            <ResponsiveImage {...props}>
            {children}
            </ResponsiveImage>
        );
    }

    renderDefaultSource() {
        const { children, defaultSource, ...props } = this.props;
        return (
            <CacheableImage {...props} source={defaultSource}>
            {children}
            </CacheableImage>
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
