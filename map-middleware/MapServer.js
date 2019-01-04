const BinaryToPng = require('./BinaryToPng');
const Config = require('./config.json');

const fs = require('fs');
const path = require('path');

const UNUSED_FILENAME_PART = 'acdcabba_0_';
const MAP_FILE_PNG_EXTENSION = '.png';
const MAP_FILE_EXTENSION = '.map';
const MAP_PNG_DIR = 'images/';


/**
 * Gets as parameter @filePath where map files are/will be located, and observes their changes. 
 */
class MapServer {

  constructor(io) {

    this.io = io;

    this.filePath = Config.mapDataFilePath;
    console.log('Map file path ' + this.filePath);

    // key: map page id, value: png-filename
    this.currentMapFiles = {};

    if (!fs.existsSync(MAP_PNG_DIR)) {
      fs.mkdirSync(MAP_PNG_DIR);
    }

    // Delete old png map files
    fs.readdir(MAP_PNG_DIR, (err, files) => {
      if (err) throw err;
      for (const file of files) {
        fs.unlink(path.join(MAP_PNG_DIR, file), err => {
          if (err) throw err;
        });
      }
    });


    // Observe for new or changed files

    const that = this;
    const handleFile = (filename) => {
      if (fs.existsSync(this.filePath + filename)) {
        if (filename && filename.includes(MAP_FILE_EXTENSION)) {

          console.log('Map file changed: ' + filename);
          const mapPageId = that.getPageIDFromFilename(filename);
          that.currentMapFiles[filename] = that.getPngFromBinaryFile(filename, mapPageId);

        } else {
          console.log('File does not exist (yet?)', filename);
        }
      }
    };


    // Get current map files
    fs.readdir(this.filePath, (err, files) => {
      try {
        let mapBinaryFilenames = files.filter(function (el) {
          return el.toLowerCase().indexOf(MAP_FILE_EXTENSION.toLowerCase()) > -1;
        });

        for (let index = 0; index < mapBinaryFilenames.length; index++) {
          const filename = mapBinaryFilenames[index];
          handleFile(filename, this.mapFilePngReadyCallback);
        }

      } catch (error) {
        console.error(error);
      }
    });

    fs.watch(this.filePath, {
      persistent: true
    }, (event, filename) => { handleFile(filename, this.mapFilePngReadyCallback) });
  }


  getAllMapFiles(req, res) {
    try {
      console.log('Getting list of files');
      let files = [];

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

      fs.readdir(MAP_PNG_DIR, (err, files) => {
        try {
          files = files.filter(function (el) {
            return el.toLowerCase().indexOf('.png'.toLowerCase()) > -1;
          });
        } catch (error) {
          console.error(error);
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end("Dir " + this.filePath + " not found!");
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });



        let mapPages = [];
        for (let index = 0; index < files.length; index++) {
          const filename = files[index];
          const mapPageId = this.getPageIDFromFilename(filename);
          mapPages.push(this.mapPageData(mapPageId));
        }

        let returnData = { mapPages };
        res.end(JSON.stringify(returnData, null, 2));
        return;
      });

    } catch (error) {
      console.error(error);
      res.statusCode = 500;
      res.end(`Error getting the file: ${error}.`);
      return;
    }

  }

  getMapPageImage(req, res) {
    try {
      console.log('Getting a single map page');

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

      //const pathname = `${MAP_PNG_DIR}${req.params.mapPageId}`;
      const pathname = MAP_PNG_DIR + this.getFilenameFromPageID(req.params.mapPageId);
      console.log('pathname', pathname);
      fs.exists(pathname, function (exist) {
        if (!exist) {
          // if the file is not found, return 404
          res.statusCode = 404;
          res.end(`File ${pathname} not found!`);
          return;
        }

        fs.readFile(pathname, function (err, data) {
          if (err) {
            res.statusCode = 500;
            res.end(`Error getting the file: ${err}.`);
          } else {
            // if the file is found, set Content-type and send data
            res.setHeader('Content-type', 'image/png');
            res.end(data);
            return;
          }
        });
      });
    } catch (error) {
      console.error(error);
      res.statusCode = 500;
      res.end(`Error getting the file: ${error}.`);
      return;
    }

  }


  /**
   * Method is called when generating the png file is ready
   */
  mapFilePngReadyCallback(mapPageId) {
    console.log('MAP png ready', mapPageId);
    try {
      console.log('sending..');
      // Send to all instead of just one
      this.io.sockets.emit('map_page_changed', this.mapPageData(mapPageId));
      console.log('sent!');
    } catch (error) {
      console.error(error);
    }
  }


  ///// Internal
  /**
   * Gets ids of all detected map files
   */
  getAllMapFileIDs() {
    return this.currentMapFiles;
  }

  mapPageData(mapPageId) {
    return {
      mapPageId: mapPageId,
      resource: 'images/' + mapPageId + '.png',
      timestamp: Date.now()
    };
  }

  getPngFromBinaryFile(fileName, mapPageId) {
    try {

      const pngFileName = MAP_PNG_DIR + fileName + MAP_FILE_PNG_EXTENSION;
      const fullPath = Config.mapDataFilePath + fileName;

      const cb = (mapPageId) => {
        //const fileName = this.getFilenameFromPageID(mapPageId);
        //console.log('CB filename', fileName);
        this.mapFilePngReadyCallback(mapPageId);
      };

      fs.readFile(fullPath, null, function (err, data) {
        try {

          if (err) throw err;
          const imgData = new Uint8Array(data.buffer);
          const binaryToPng = new BinaryToPng(imgData);
          binaryToPng.generateImageToFile(pngFileName, mapPageId, cb);
        } catch (error) {
          console.error(error);
        }
      });

      return pngFileName;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  getFilenameFromPageID(mapPageID) {
    return mapPageID + MAP_FILE_EXTENSION + MAP_FILE_PNG_EXTENSION;
  }

  getPageIDFromFilename(filename) {
    let mapPageID = filename.split('.map')[0];
    return mapPageID;
  }
}


module.exports = MapServer;