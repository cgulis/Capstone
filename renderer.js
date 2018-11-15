// This file is required by the index.html file and will
// be executed in the renderer process for that window.

var app = require('electron').remote;
var dialog = app.dialog;
// var fs = require('fs');
var fs = require('fs');

const {
    ipcRenderer
} = require('electron')

document.getElementById('uploadButton').onclick = () => {
    dialog.showOpenDialog((fileName) => {
        if (fileName === undefined) {
            alert("File not found.");
            return;
        }
        ipcRenderer.send('kml-file-name', String(fileName));
    });
};

document.getElementById('routeButton').onclick = () => {
    ipcRenderer.send('openMapWindow');
}

ipcRenderer.on('geo-json', (event, arg) => {
    console.log(arg);
})

ipcRenderer.on('filled-array', (event, arg) => {
    var summ1 = 0;
    var elevationDataPoints = [];
    var powerDataPoints = [];

    for (var i = 0; i < arg.length; i++) {
        elevationDataPoints.push({
            x: ((Math.round(summ1) * 100) / 100) / 1000,
            y: arg[i].elev
        })
        summ1 += arg[i].dist;
    }

    var summ2 = 0;
    for (var i = 0; i < arg.length; i++) {
        powerDataPoints.push({
            x: ((Math.round(summ2) * 100) / 100) / 1000,
            y: arg[i].pow
        })
        summ2 += arg[i].dist;
    }

    var totalConsumption = 0;
    for (var i = 0; i < arg.length; i++) {
        if (arg[i].alpha > -0.00559) {
            totalConsumption += arg[i].pow;
        }
    }

    var ctx = document.getElementById('initChart').getContext('2d');
    var chart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                    label: 'elevation',
                    yAxisID: 'elevation',
                    fill: false,
                    // backgroundColor: 'rgb(0, 0, 0)',
                    borderColor: 'rgb(255, 156, 156)',
                    data: elevationDataPoints,
                    pointRadius: 0,
                    lineTension: 0
                },
                {
                    label: 'power',
                    yAxisID: 'power',
                    backgroundColor: 'rgb(66, 244, 229)',
                    data: powerDataPoints,
                    pointRadius: 1,
                    lineTension: 0
                }
            ]
        },
        options: {
            scales: {
                yAxes: [{
                        id: 'elevation',
                        scaleLabel: {
                            display: true,
                            labelString: 'Elevation in m'
                        },
                        position: 'left'
                    },
                    {
                        id: 'power',
                        scaleLabel: {
                            display: true,
                            labelString: 'Power in J'
                        },
                        position: 'right'
                    }
                ],
                xAxes: [{
                    ticks: {
                        min: 0
                        // max: dataPoints[dataPoints.length-1][1]
                    },
                    scaleLabel: {
                        display: true,
                        labelString: 'Distance in km'
                    }
                }]
            }
        }
    });
    document.getElementById("consumed-energy").innerHTML = "Estimated Energy Consumed Along Route: " + (Math.round(totalConsumption / 3600) * 100) / 100 + " Wh";
})