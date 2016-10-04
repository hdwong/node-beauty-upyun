"use strict";
let core, config, logger, client, m = require('upyun');

let serviceName = 'upyun';
let upyun = {
  assert: (error) => {
    if (error) {
      logger.error(error);
      throw '[' + serviceName + '] ' + error;
    }
  },
  init: (name, c) => {
    serviceName = name;
    core = c;
    logger = core.getLogger(serviceName);
    config = core.getConfig(serviceName);
    client = new m(config.name || '', config.user || '', config.password || '',
        'v0', 'legacy');
    if (!config.enable_api) {
      // disable upyun api
      delete upyun.post_file;
      delete upyun.post_copy;
      delete upyun.delete_file;
    }
  },
  upload: (type, filename, content, mime, next) => {
    let dir, extname;
    let pad2 = (n) => n <= 9 ? ('0' + n) : n.toString(), d = new Date();
    dir = type + '/' + d.getFullYear() + '/' + pad2(d.getMonth() + 1) + '/' +
        pad2(d.getDate()) + '/';
    extname = require('path').extname(filename);
    mime = mime || require('mime').lookup(extname);
    dir += core.randomString(parseInt(config.random_len || 4, 10)) + extname;
    client.uploadFile('/' + dir, content, mime, true, (error, result) => {
      upyun.assert(error);
      if (result.error !== undefined) {
        upyun.assert(result.error.message);
      }
      if (result.statusCode != 200) {
        return next(false);
      }
      next({
        type: type,
        org_filename: filename,
        filename: dir,
        mime: mime,
        size: content.length,
      });
    });
  },
  post_file: (req, res, next) => {
    if (!req.body || req.body.filename === undefined || req.body.content === undefined) {
      throw 'Params is wrong';
    }
    let content = new Buffer(req.body.content, 'base64'),
        type = req.body.type ? req.body.type : 'upload';
    upyun.upload(type, req.body.filename, content, null, next);
  },
  post_copy: (req, res, next) => {
    if (!req.body || req.body.url === undefined) {
      throw 'Params is wrong';
    }
    let type = req.body.type ? req.body.type : 'upload';
    require('request').get({
      url: req.body.url,
      encoding: null
    }, (error, response, body) => {
      upyun.assert(error);
      if (response.statusCode !== 200) {
        upyun.assert('Response is invalid');
      }
      upyun.upload(type, require('path').basename(req.body.url), body, response['content-type'], next);
    });
  },
  delete: (filename, next) => {
    client.removeFile('/' + filename, (error, result) => {
      upyun.assert(error);
      if (result.error !== undefined || result.statusCode != 200) {
        return next(false);
      }
      next(true);
    });
  },
  delete_file: (req, res, next) => {
    if (!req.body || req.body.filename === undefined) {
      throw 'Params is wrong';
    }
    upyun.delete(req.body.filename, next);
  }
};

module.exports = upyun;
