// Modules to control application life and create native browser window
const {
  app,
  BrowserWindow,
  Menu,
  ipcMain
} = require('electron')

require('electron-reload')(__dirname);

let mainWindow
let addWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 600
  })
  mainWindow.loadFile('index.html')
  // Open the DevTools.
  mainWindow.webContents.openDevTools()
  mainWindow.on('closed', function () {
    mainWindow = null
  })

  const mainMenu = Menu.buildFromTemplate(mainMenuTemplate)
  Menu.setApplicationMenu(mainMenu)
}

ipcMain.on('openMapWindow', () => {
  addWindow = new BrowserWindow({
    width: 750,
    height: 500,
    title: 'Select Your Route'
  })
  addWindow.loadFile('map.html')
  addWindow.webContents.openDevTools()
})

ipcMain.on('closeMapWindow', () => {
  console.log("close window button selected");
  addWindow.close();
})

function createAddWindow() {
  addWindow = new BrowserWindow({
    width: 750,
    height: 500,
    title: 'Select Your Route'
  })
  addWindow.loadFile('map.html')
}

app.on('ready', createWindow)

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow()
  }
})

// Create menu template
const mainMenuTemplate = [{
  label: 'File',
  submenu: [{
      label: 'Use Map',
      click() {
        createAddWindow();
      }
    },
    {
      label: 'Import File'
    },
    {
      label: 'Quit',
      accelerator: process.platform == 'darwin' ? 'Command+Q' : 'Ctrl+Q',
      click() {
        app.quit()
      }
    }
  ]
}]


var tj = require('./node_modules/@mapbox/togeojson'),
  fs = require('fs'),
  DOMParser = require('xmldom').DOMParser;
const haversine = require('haversine');
var itemsProcessed = 0;
var coordinateElev = new Array();

const googleMapsClient = require('@google/maps').createClient({
  key: 'AIzaSyC0qtIQto3cnhYg-SRWkZLB8tqi4M_RssA',
  Promise: Promise
});

ipcMain.on('kml-file-name', (event, arg) => {
  var kml = new DOMParser().parseFromString(fs.readFileSync(arg, 'utf8'));
  var convertedWithStyles = tj.kml(kml, {
    styles: true
  });
  var myJSON = JSON.stringify(convertedWithStyles);
  var geoObj = JSON.parse(myJSON);

  var coordinates = geoObj.features[1].geometry.coordinates;

  getDistance(coordinates);
  // event.sender.send('geo-json',coordinates);
})

function getDistance(coordArray) {
  var coordDistance = new Array();
  for (var i = 0; i < coordArray.length - 1; i++) {
    var j = i + 1;
    var start = {
      latitude: coordArray[i][1],
      longitude: coordArray[i][0]
    }
    var end = {
      latitude: coordArray[j][1],
      longitude: coordArray[j][0]
    }
    coordDistance.push([coordArray[i][1], coordArray[i][0], coordArray[i][2], Math.round(haversine(start, end, {
      unit: 'meter'
    }) * 100) / 100]);
    if ((i + 2) == coordArray.length) {
      coordDistance.push([coordArray[i + 1][1], coordArray[i + 1][0], coordArray[i + 1][2], 0]);
    }
  }
  // console.log(coordDistance);
  populateElevation(coordDistance)
}

function populateElevation(coordinates) {
  for (var i = 0; i < coordinates.length; i++) {
    getElevationAtPoint(coordinates[i], i, coordinates.length);
  }
}

function getElevationAtPoint(coords, index, length) {
  googleMapsClient.elevation({
      locations: {
        lat: coords[0],
        lng: coords[1]
      }
    })
    .asPromise()
    .then(function (response) {
      itemsProcessed++;
      coordinateElev.push([index, coords[0], coords[1], Math.round(response.json.results[0].elevation * 100) / 100, coords[3], 0]);
      if (itemsProcessed == length) {
        coordinateElev.sort(function (a, b) {
          return a[0] - b[0];
        });
        calcGradient(coordinateElev);
      }
    })
    .catch((err) => {
      console.log(err);
    });
}

function calcGradient(array) {
  for (var i = 0; i < array.length - 1; i++) {
    var j = i + 1
    array[i][5] = Math.atan((array[j][3] - array[i][3]) / array[i][4]) * (180 / Math.PI)
  }
  calcEnergyConsumption(array)
  // mainWindow.webContents.send('filled-array',array)
}

function calcEnergyConsumption(pointsArr) {
  var ur = 0.005
  var alpha = 0.0
  var m = 544
  var g = 9.8
  var nttw = 0.89
  var rho = 1.225
  var A = 2.1
  var cd = .18
  var v = 30.0
  var Fte = 0.0
  var de = 0.0
  var ci = 0.0
  var acc = 0.0

  var energyConsumption = [];

  for (var i = 0; i < pointsArr.length - 1; i++) {
    de = pointsArr[i][4]

    alpha = pointsArr[i][5]

    Fte = (ur * m * g) + (0.5 * rho * A * cd * Math.pow(v, 2)) + (m * g * Math.sin(alpha)) + (ci * m * acc)
    var power = Math.round(((Fte * de) / nttw) * 100) / 100;

    energyConsumption.push({
      elev: pointsArr[i][3],
      dist: pointsArr[i][4],
      pow: power,
      alpha: alpha
    })
  }
  mainWindow.webContents.send('filled-array', energyConsumption)
}