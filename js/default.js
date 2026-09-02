//// THIS CODE AND INFORMATION IS PROVIDED "AS IS" WITHOUT WARRANTY OF
//// ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING BUT NOT LIMITED TO
//// THE IMPLIED WARRANTIES OF MERCHANTABILITY AND/OR FITNESS FOR A
//// PARTICULAR PURPOSE.
////
//// Copyright (c) Microsoft Corporation. All rights reserved

// 有关“空白”模板的简介，请参阅以下文档:
// http://go.microsoft.com/fwlink/?LinkId=232509
(function () {
    "use strict";
    var isPreRelease = false;
    var g_receiver = null;
    var g_displayRequest = null;
    var g_receiverStarted = false;
    var g_elementHandler = makeElementHandler();
    var g_receiverHandler = makeReceiverHandler();
    var g_stopping = false;
    var g_pause = true;
    var g_hasVideoSource = false;
    var g_imageURL = null;
    var page = WinJS.UI.Pages.define("default.html");
    WinJS.Binding.optimizeBindingReferences = true;
    var app = WinJS.Application;
    var activation = Windows.ApplicationModel.Activation;
    app.onactivated = function (args) {
        if (args.detail.kind === activation.ActivationKind.launch) {
            if (args.detail.previousExecutionState !== activation.ApplicationExecutionState.terminated) {
                // TODO: 此应用程序刚刚启动。在此处初始化
                //您的应用程序。
                if (isPreRelease) {
                    document.getElementById("preReleaseWarning").style.display = "";
                }
                // Make sure the following is called after the DOM has initialized. Typically this would be part of app initialization
                // WinJS.Application.start();
                 
                // Display a status message in the SDK sample output region
                // displayShape("Help command and settings flyout added from settings.html");
            } else {
                // TODO: 此应用程序已从挂起状态重新激活。
                // 在此处恢复应用程序状态。
            }
            onResize();
            window.addEventListener("resize", onResize);
            document.getElementById("startButton").addEventListener("click", startPlayToReceiver, false);
            document.getElementById("stopButton").addEventListener("click", stopPlayToReceiver, false);

            startPlayToReceiver();
            args.setPromise(WinJS.UI.processAll());
        }
    };
    app.oncheckpoint = function (args) {
        // TODO: 即将挂起此应用程序。在此处保存
        //需要在挂起中保留的任何状态。您可以使用
        // WinJS.Application.sessionState 对象，该对象将在
        //挂起中自动保存和恢复。如果您需要在
        //挂起应用程序之前完成异步操作，请调用
        // args.setPromise()。
        // stopPlayToReceiver();
    };
    app.onsettings = function (e) {
        e.detail.applicationcommands = { "settings": { title: "设置 Settings", href: "settings.html" } };
        WinJS.UI.SettingsFlyout.populateSettings(e);
    };
    app.start();
    function startPlayToReceiver() {
        try {
            if (!g_receiver) {
                g_receiver = new Windows.Media.PlayTo.PlayToReceiver();
            }
            if (g_receiverStarted) {
                displayShape("Receiver already started");
                return;
            }

            //
            // Connect: element -> PlayToReceiver
            //
            var dmrVideo = document.getElementById("dmrVideo");
            var dmrImage = document.getElementById("dmrImage");
            dmrVideo.addEventListener("volumechange", g_elementHandler.volumechange, false);
            dmrVideo.addEventListener("ratechange", g_elementHandler.ratechange, false);
            dmrVideo.addEventListener("loadedmetadata", g_elementHandler.loadedmetadata, false);
            dmrVideo.addEventListener("durationchange", g_elementHandler.durationchange, false);
            dmrVideo.addEventListener("seeking", g_elementHandler.seeking, false);
            dmrVideo.addEventListener("seeked", g_elementHandler.seeked, false);
            dmrVideo.addEventListener("playing", g_elementHandler.playing, false);
            dmrVideo.addEventListener("pause", g_elementHandler.pause, false);
            dmrVideo.addEventListener("ended", g_elementHandler.ended, false);
            dmrVideo.addEventListener("error", g_elementHandler.error, false);
            dmrImage.addEventListener("load", onLoadImage);

            //
            // Connect: PlayToReceiver -> element
            //
            g_receiver.addEventListener("playrequested", g_receiverHandler.playrequested, false);
            g_receiver.addEventListener("pauserequested", g_receiverHandler.pauserequested, false);
            g_receiver.addEventListener("sourcechangerequested", g_receiverHandler.sourcechangerequested, false);
            g_receiver.addEventListener("playbackratechangerequested", g_receiverHandler.playbackratechangerequested, false);
            g_receiver.addEventListener("currenttimechangerequested", g_receiverHandler.currenttimechangerequested, false);
            g_receiver.addEventListener("mutechangerequested", g_receiverHandler.mutedchangerequested, false);
            g_receiver.addEventListener("volumechangerequested", g_receiverHandler.volumechangerequested, false);
            g_receiver.addEventListener("timeupdaterequested", g_receiverHandler.timeupdaterequested, false);
            g_receiver.addEventListener("stoprequested", g_receiverHandler.stoprequested, false);
            g_receiver.supportsVideo = true;
            g_receiver.supportsAudio = true;
            g_receiver.supportsImage = true;
            g_receiver.friendlyName = Windows.Storage.ApplicationData.current.localSettings.values["receiverName"] || 'Dahlia PlayToReceiver';

            //
            // Advertise the receiver on the local network and start receiving commands
            //
            g_receiver.startAsync().then(function () {
                g_receiverStarted = true;
                g_receiver.notifyVolumeChange(document.getElementById("dmrVideo").volume, document.getElementById("dmrVideo").muted);
                //
                // Prevent the screen from locking
                //
                if (!g_displayRequest) {
                    g_displayRequest = new Windows.System.Display.DisplayRequest();
                }
                g_displayRequest.requestActive();

                displayShape("Receiver \"" + g_receiver.friendlyName + "\" started.");
            }, function (e) {
                displayShape("Receiver \"" + g_receiver.friendlyName + "\" returned an error (" + e.message + ")");
                removeVideoEventListeners();
                removeDMREventListeners();
            });
        }
        catch (err) {
            displayError("Error : " + err.message);
            g_receiver = null;
            g_receiverStarted = false;
        }
    }
    function makeElementHandler() {
        return {
            volumechange: function () { g_receiver.notifyVolumeChange(document.getElementById("dmrVideo").volume, document.getElementById("dmrVideo").muted); },
            ratechange: function () { g_receiver.notifyRateChange(document.getElementById("dmrVideo").playbackRate); },
            loadedmetadata: function () { g_receiver.notifyLoadedMetadata(); },
            durationchange: function () { g_receiver.notifyDurationChange(document.getElementById("dmrVideo").duration * 1000); },
            seeking: function () {
                if (!g_stopping) {
                    g_receiver.notifySeeking();
                }
            },
            seeked: function () {
                if (g_stopping) {
                    g_stopping = false;
                }
                else {
                    g_receiver.notifySeeked();
                }
            },
            playing: function () { g_receiver.notifyPlaying(); },
            pause: function () {
                if (g_stopping || (!g_pause && document.getElementById("dmrVideo").currentTime === 0)) {
                    g_receiver.notifyStopped();
                }
                else {
                    g_receiver.notifyPaused();
                    g_pause = false;
                }
            },
            ended: function () { g_receiver.notifyEnded(); },
            error: function () {
                if (g_hasVideoSource) {
                    g_receiver.notifyError();
                    g_receiver.notifyStopped();
                }
            }
        };
    }
    function makeReceiverHandler() {
        return {
            playrequested: function () {
                if (g_imageURL === null) {
                    document.getElementById("dmrVideo").play();
                }
                else {
                    document.getElementById("dmrImage").src = g_imageURL;
                    g_receiver.notifyPlaying();
                }
            },
            pauserequested: function () {
                if (!g_imageURL) {
                    g_pause = true;
                    g_stopping = false;
                    document.getElementById("dmrVideo").pause();
                }
            },
            playbackratechangerequested: function (eventIn) {
                if (!g_imageURL) {
                    document.getElementById("dmrVideo").playbackRate = eventIn.rate;
                }
            },
            mutedchangerequested: function (eventIn) { document.getElementById("dmrVideo").muted = eventIn.mute; },
            volumechangerequested: function (eventIn) {
                if (document.getElementById("followSourceVolume").checked) {
                    document.getElementById("dmrVideo").volume = eventIn.volume;
                }
            },
            currenttimechangerequested: function (eventIn) {
                if (!g_imageURL) {
                    document.getElementById("dmrVideo").currentTime = eventIn.time / 1000;
                }
            },
            sourcechangerequested: function (eventIn) {
                if (!eventIn.stream) {
                    g_hasVideoSource = false;
                    document.getElementById("dmrVideo").removeAttribute("src");
                    document.getElementById("dmrImage").style.display = "none";
                    document.getElementById("dmrVideo").style.display = "none";
                } else {
                    var blob = MSApp.createBlobFromRandomAccessStream(eventIn.stream.contentType, eventIn.stream);
                    if (eventIn.stream.contentType.substring(0, 5) !== "image") {
                        showVideo();
                        g_hasVideoSource = true;
                        document.getElementById("dmrVideo").src = URL.createObjectURL(blob, { oneTimeOnly: true });
                        g_imageURL = null;
                    }
                    else {
                        g_imageURL = URL.createObjectURL(blob, { oneTimeOnly: true });
                        g_hasVideoSource = false;
                        document.getElementById("dmrVideo").removeAttribute("src");
                        g_receiver.notifyDurationChange(0);
                        g_receiver.notifyLoadedMetadata();
                    }
                }
            },
            timeupdaterequested: function (eventIn) {
                if (!g_imageURL) {
                    g_receiver.notifyTimeUpdate(document.getElementById("dmrVideo").currentTime * 1000);
                } else {
                    g_receiver.notifyTimeUpdate(0);
                }
            },
            stoprequested: function (eventIn) {
                if (!g_imageURL) {
                    if (document.getElementById("dmrVideo").readyState !== 0) {
                        g_pause = false;
                        g_stopping = true;

                        if (document.getElementById("dmrVideo").paused) {
                            if (document.getElementById("dmrVideo").currentTime !== 0) {
                                document.getElementById("dmrVideo").currentTime = 0;
                            }
                            g_receiver.notifyStopped();
                        }
                        else {
                            document.getElementById("dmrVideo").pause();
                            document.getElementById("dmrVideo").currentTime = 0;
                        }
                    }
                    else {
                        g_receiver.notifyError();
                        g_receiver.notifyStopped();
                    }
                }
                else {
                    document.getElementById("dmrImage").style.display = "none";
                    g_receiver.notifyStopped();
                }
            }
        };
    }
    function stopPlayToReceiver() {
        if (g_receiver && g_receiverStarted) {

            removeVideoEventListeners();
            g_receiver.stopAsync().then(function () {
                removeDMREventListeners();

                g_displayRequest.requestRelease();

                g_receiverStarted = false;
                displayShape("Receiver stopped.");
            },
            function (e) {
                displayError("Receiver could not stop. Error = " + e.message);
            });
        } else {
            displayShape("Receiver not started.");
        }
    }
    function removeDMREventListeners() {
        g_receiver.removeEventListener("playrequested", g_receiverHandler.playrequested, false);
        g_receiver.removeEventListener("pauserequested", g_receiverHandler.pauserequested, false);
        g_receiver.removeEventListener("sourcechangerequested", g_receiverHandler.sourcechangerequested, false);
        g_receiver.removeEventListener("playbackratechangerequested", g_receiverHandler.playbackratechangerequested, false);
        g_receiver.removeEventListener("currenttimechangerequested", g_receiverHandler.currenttimechangerequested, false);
        g_receiver.removeEventListener("mutedchangerequested", g_receiverHandler.mutedchangerequested, false);
        g_receiver.removeEventListener("volumechangerequested", g_receiverHandler.volumechangerequested, false);
        g_receiver.removeEventListener("timeupdaterequested", g_receiverHandler.timeupdaterequested, false);
        g_receiver.removeEventListener("stoprequested", g_receiverHandler.stoprequested, false);
    }
    function removeVideoEventListeners() {
        var video = document.getElementById("dmrVideo");
        if (!video.paused) {
            video.pause();
        }
        video.removeEventListener("volumechange", g_elementHandler.volumechange, false);
        video.removeEventListener("ratechange", g_elementHandler.ratechange, false);
        video.removeEventListener("loadedmetadata", g_elementHandler.loadedmetadata, false);
        video.removeEventListener("durationchange", g_elementHandler.durationchange, false);
        video.removeEventListener("seeking", g_elementHandler.seeking, false);
        video.removeEventListener("seeked", g_elementHandler.seeked, false);
        video.removeEventListener("playing", g_elementHandler.playing, false);
        video.removeEventListener("pause", g_elementHandler.pause, false);
        video.removeEventListener("ended", g_elementHandler.ended, false);
        video.removeEventListener("error", g_elementHandler.error, false);
    }
})();

function displayError(str) {
    var errors = document.getElementById("errors");
    errors.textContent = str + '\n' + errors.textContent;
}
function displayShape(str) {
    if (true) {
        var shapes = document.getElementById("shapes");
        shapes.textContent = str + '\n' + shapes.textContent;
    }
}
function showVideo() {
    document.getElementById("dmrImage").style.display = "none";
    document.getElementById("dmrVideo").style.display = "";
    document.getElementById("preReleaseWarning").style.display = "none";
    // document.getElementById("DMRsContainer").style.left = "0" + "px";
    // document.getElementById("DMRsContainer").style.top = "0" + "px";
    clear2();
}
function showImage() {
    document.getElementById("dmrVideo").style.display = "none";
    document.getElementById("dmrImage").style.display = "";
    document.getElementById("preReleaseWarning").style.display = "none";
    clear2();
}
function onLoadImage() {
    if (true) {
        var image = document.getElementById("dmrImage");
        var clientWidth = document.body.clientWidth;
        var clientHeight = document.body.clientHeight;
        var dblZoomRatio = 1.0;
        if (image.naturalWidth !== clientWidth && image.naturalHeight !== clientHeight &&
            image.naturalWidth !== 0 && image.naturalHeight !== 0) {
            var dblWidthZoom = clientWidth / image.naturalWidth;
            var dblHeightZoom = clientHeight / image.naturalHeight;
            dblZoomRatio = Math.min(dblHeightZoom, dblWidthZoom);
        }
        image.style.width = (image.naturalWidth * dblZoomRatio) + "px";
        image.style.height = (image.naturalHeight * dblZoomRatio) + "px";
        //document.getElementById("DMRsContainer").style.left = String(document.body.clientWidth / 2 - image.style.width / 2) + "px";
        //document.getElementById("DMRsContainer").style.top = String(document.body.clientHeight / 2 - image.style.height / 2) + "px";
    }
    showImage();
}

function onResize() {
    var myViewState = Windows.UI.ViewManagement.ApplicationView.value;
    var viewStates = Windows.UI.ViewManagement.ApplicationViewState;
    var statusText;
    switch (myViewState) {
        case viewStates.snapped:
            statusText = "This app is snapped!";
            locateandResizeDMR(320, 240);
            break;
        case viewStates.filled:
            statusText = "This app is in filled state!";
            locateandResizeDMR(640,480);
            break;
        case viewStates.fullScreenLandscape:
            statusText = "This app is full screen landscape!";
            locateandResizeDMR(640, 480);
            break;
        case viewStates.fullScreenPortrait:
            statusText = "This app is full screen portrait!";
            locateandResizeDMR(640, 480);
            break;
        default:
            statusText = "Error: Invalid view state returned.";
            break;
    }
    // displayShape(statusText);
}

function locateandResizeDMR(width, height) {
    if (false) {
        document.getElementById("dmrVideo").style.width = String(width) + "px";
        document.getElementById("dmrImage").style.width = String(width) + "px";
        document.getElementById("dmrVideo").style.height = String(height) + "px";
        document.getElementById("dmrImage").style.height = String(height) + "px";
        document.getElementById("DMRsContainer").style.left = String(document.body.clientWidth / 2 - width / 2) + "px";
        // displayShape("Current location: " + String(window.screen.width / 2 - width / 2) + "px");
        // displayShape("视口宽度：" + String(document.documentElement.clientWidth) + "px");
        // displayShape("内部宽度：" + String(window.innerWidth) + "px");
        displayShape("可见宽度：" + String(document.body.clientWidth) + "px");
    }
}

function popup(message) {
    Windows.UI.Popups.MessageDialog(message).showAsync();
}

function about() {
    var message='Reversed Projector\n' +
        '本应用的部分代码基于 Microsoft Windows 8 App Samples，\n版权归 © Microsoft Corporation 所有。\n' +
        'This application contains portions of code from Microsoft Windows 8 App Samples,\n© Microsoft Corporation.\n' +
        '启动画面和图标来自米游社用户久梦/黑巧\n' +
        '\n'
        ;
    var msg = new Windows.UI.Popups.MessageDialog(message, "关于 About");

    
    msg.commands.append(new Windows.UI.Popups.UICommand("MS-LPL License", function () {
        
        Windows.ApplicationModel.Package.current.installedLocation
            .getFileAsync("MS-LPL.rtf")
            .then(function (file) {
                return Windows.System.Launcher.launchFileAsync(file);
            });
    }));

    msg.commands.append(new Windows.UI.Popups.UICommand("消除 Dismiss"));

    msg.defaultCommandIndex = 1;
    msg.cancelCommandIndex = 1;

    msg.showAsync();
}