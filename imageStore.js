import { AsyncStorage } from 'react-native';

import { ImageLoader } from './imageLoader';

const SHA1 = require("crypto-js/sha1");

export class ImageStore {
  _imageLoader: object;

  constructor() {
    this._imageLoader = new ImageLoader();
    this.get = this.get.bind(this);
    this.put = this.put.bind(this);
    this.remove = this.remove.bind(this);
    this._getCacheKeyForUrl = this._getCacheKeyForUrl.bind(this);
    this._getStorageKeyForUrl = this._getStorageKeyForUrl.bind(this);
    this._getStorageKeyForCacheKey = this._getStorageKeyForCacheKey.bind(this);
  }

  _getCacheKeyForUrl(url: Url) {
    return SHA1(url.pathname);
  }

  _getStorageKeyForUrl(url: Url) {
    return `@Store:${this._getCacheKeyForUrl(url)}`;
  }
  _getStorageKeyForCacheKey(cacheKey: string) {
    return `@Store:${cacheKey}`;
  }

  get(cacheKey) {
    return AsyncStorage.getItem(this._getStorageKeyForCacheKey(cacheKey));
  }

  put(imageUrl) {
    return this._imageLoader.load(imageUrl, this._getCacheKeyForUrl(imageUrl));
  }

  remove(cacheKey) {
    return AsyncStorage.setItem(this._getStorageKeyForCacheKey(cacheKey),'');
  }
}