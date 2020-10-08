import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Grid from "@material-ui/core/Grid";

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    backgroundColor: "#424242",
  },
  paper: {
    padding: theme.spacing(2),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
  video: {
    height: "100%",
    width: "100%",
  },
}));

const Videos = (props) => {
  const classes = useStyles();
  function setSrcObject(ref, stream) {
    if (ref) {
      ref.srcObject = stream;
    }
  }
  return (
    <Grid container spacing={3}>
      <Grid item xs={3}>
        <Paper className={classes.paper}>
          <video
            className={classes.video}
            autoPlay
            ref={props.userVideo}
            muted
          />
        </Paper>
      </Grid>
      {props.streams.map((stream) => (
        <Grid item xs={3}>
          <Paper className={classes.paper}>
            <video
              className={classes.video}
              inline
              ref={(ref) => setSrcObject(ref, stream)}
              autoPlay
            />
            <h1>THIS IS A BIG BLOCK</h1>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
};
const Room = (props) => {
  const classes = useStyles();

  const userVideo = useRef();
  const socketRef = useRef();
  const userStream = useRef();

  const [peersVideo, setPeersVideo] = useState([]);
  const [peersRef, setPeersRef] = useState({});
  const dataChannel = useRef({});
  const [videoShow, setVideoShow] = useState({});

  const roomID = props.match.params.roomID;

  const youtubePlayer = useRef({});
  const [videoID, setVideoID] = useState("");
  const videoState = useRef({});
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((stream) => {
        userVideo.current.srcObject = stream;
        console.log(userVideo.current);
        console.log(stream);
        userStream.current = stream;

        socketRef.current = io.connect("/");
        socketRef.current.emit("join room", props.match.params.roomID);

        socketRef.current.on("other user", (users) => {
          users.forEach((userID) => {
            const peer = callUser(userID);
          });
        });

        socketRef.current.on("user joined", (userID) => {});

        socketRef.current.on("offer", handleRecieveCall);

        socketRef.current.on("answer", handleAnswer);

        socketRef.current.on("ice-candidate", handleNewICECandidateMsg);
      })
      .catch((e) => {
        console.log(e);
      });
  }, []);
  useEffect(() => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    window.onYouTubeIframeAPIReady = loadVideoPlayer;
  }, []);

  function callUser(userID) {
    const peer = createPeer(userID);
    const temp = peersRef;
    temp[userID] = peer;
    setPeersRef(temp);
    //setPeersRef((peersRef) => ({ ...peersRef, [userID]: peer }));
    console.log(peersRef);
    dataChannel.current[userID] = createChannel(userID);
    userStream.current.getTracks().forEach((track) => {
      console.log(track);
      peersRef[userID].addTrack(track, userStream.current);
    });
    return peer;
  }

  function createPeer(userID) {
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: ["stun:ss-turn1.xirsys.com"] },
        {
          username:
            "N8NQ9gRUMu2Ct4g5ZrNa8xG1kfsWURT04hMxht3BzMpO4yJvTHzO_wUhnE5kd3hRAAAAAF96H9pheXVzaDE4OTk=",
          credential: "48df722e-0676-11eb-b4fb-0242ac140004",
          urls: [
            "turn:ss-turn1.xirsys.com:80?transport=udp",
            "turn:ss-turn1.xirsys.com:3478?transport=udp",
            "turn:ss-turn1.xirsys.com:80?transport=tcp",
            "turn:ss-turn1.xirsys.com:3478?transport=tcp",
            "turns:ss-turn1.xirsys.com:443?transport=tcp",
            "turns:ss-turn1.xirsys.com:5349?transport=tcp",
          ],
        },
      ],
    });

    peer.onicecandidate = (e) => handleICECandidateEvent(e, userID);
    peer.ontrack = (e) => handleTrackEvent(e, userID);
    peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userID);
    peer.ondatachannel = (e) => {
      console.log(e.channel);
      dataChannel.current[userID] = e.channel;
      console.log(dataChannel.current[userID]);
      dataChannel.current[userID].onmessage = (e) => handleMessage(e, userID);
    };
    peer.onconnectionstatechange = (e) =>
      handleConnectionStateChange(e, userID);
    return peer;
  }
  function createChannel(userID) {
    const channel = peersRef[userID].createDataChannel("Data Chn");
    console.log(channel);
    channel.onmessage = (e) => handleMessage(e, userID);
    return channel;
  }
  function handleNegotiationNeededEvent(userID) {
    console.log("HANDLING NEGOTIATION EVENT WITH " + userID);
    peersRef[userID]
      .createOffer()
      .then((offer) => {
        return peersRef[userID].setLocalDescription(offer);
      })
      .then(() => {
        const payload = {
          target: userID,
          caller: socketRef.current.id,
          sdp: peersRef[userID].localDescription,
        };
        console.log(payload);
        socketRef.current.emit("offer", payload);
      })
      .catch((e) => console.log(e));
  }

  function handleRecieveCall(incoming) {
    console.log("HANDLING RECIEVE CALL FROM " + incoming.caller);
    const callerID = incoming.caller;
    const temp = peersRef;
    temp[callerID] = createPeer(callerID);
    setPeersRef(temp);
    console.log(callerID);
    console.log(peersRef[callerID]);
    const desc = new RTCSessionDescription(incoming.sdp);
    console.log(desc);
    peersRef[callerID]
      .setRemoteDescription(desc)
      .then(() => {
        userStream.current
          .getTracks()
          .forEach((track) =>
            peersRef[callerID].addTrack(track, userStream.current)
          );
      })
      .then(() => {
        return peersRef[callerID].createAnswer();
      })
      .then((answer) => {
        return peersRef[callerID].setLocalDescription(answer);
      })
      .then(() => {
        const payload = {
          target: incoming.caller,
          caller: socketRef.current.id,
          sdp: peersRef[callerID].localDescription,
        };
        socketRef.current.emit("answer", payload);
      });
  }

  function handleAnswer(message) {
    const desc = new RTCSessionDescription(message.sdp);
    peersRef[message.caller]
      .setRemoteDescription(desc)
      .catch((e) => console.log(e));
  }

  function handleICECandidateEvent(e, userID) {
    console.log("ICE CANDIDATE +" + e);
    if (e.candidate) {
      const payload = {
        caller: socketRef.current.id,
        target: userID,
        candidate: e.candidate,
      };
      socketRef.current.emit("ice-candidate", payload);
    }
  }

  function handleNewICECandidateMsg(incoming) {
    const candidate = new RTCIceCandidate(incoming.candidate);

    peersRef[incoming.caller]
      .addIceCandidate(candidate)
      .catch((e) => console.log(e));
  }

  function handleTrackEvent(e, userID) {
    console.log(e);
    console.log(e.streams[0].getTracks());
    console.log(userID);
    if (videoShow[userID] == null) {
      let remoteStream = e.streams[0];
      setPeersVideo((remoteStreams) => [...remoteStreams, remoteStream]);
      const tempVideoShow = videoShow;
      tempVideoShow[userID] = e.streams[0];
      setVideoShow(tempVideoShow);
      console.log(videoShow);
    }
  }

  function handleConnectionStateChange(e, userID) {
    console.log(e);
    console.log(userID);
    const currState = e.currentTarget.iceConnectionState;
    if (currState == "disconnected") {
      //Remove from Socket Room
      socketRef.current.emit(
        "remove user",
        JSON.stringify({ roomID: roomID, userID: userID })
      );
      //Remove from PeersRef

      console.log("WE ARE HERE");
      const tempPeersRef = peersRef;
      delete tempPeersRef[userID];
      setPeersRef(tempPeersRef);
      //Remove from DataChannelRef
      delete dataChannel.current[userID];
      //Remove from Video Show
      const tempVideoShow = videoShow;
      delete tempVideoShow[userID];
      setVideoShow(tempVideoShow);
      const temp = [];
      Object.entries(videoShow).forEach(([key, stream]) => {
        console.log(`${key}: ${stream}`);
        temp.push(stream);
      });
      setPeersVideo(temp);
      console.log(peersRef);
      console.log(videoShow);
      console.log(dataChannel.current);
      console.log("DONE HERE");
    }
  }

  function sendMessage(value, key, map) {
    console.log(videoState.current);
    if (videoState.current == "play") {
      value.send(JSON.stringify({ type: "play" }));
    } else if (videoState.current == "pause") {
      value.send(JSON.stringify({ type: "pause" }));
    } else {
      value.send(JSON.stringify({ type: "newVideo", data: videoID }));
    }
  }
  function handleMessage(e, userID) {
    const msg = JSON.parse(e.data);
    console.log("Control changed from " + userID);
    console.log(msg);
    if (msg.type === "newVideo") {
      youtubePlayer.current.loadVideoById(msg.data.split("=")[1]);
    } else if (msg.type === "pause") {
      youtubePlayer.current.pauseVideo();
    } else if (msg.type === "play") {
      youtubePlayer.current.playVideo();
    }
  }
  function sendMsg(task) {
    console.log(dataChannel.current);
    Object.values(dataChannel.current).forEach(sendMessage);
  }

  ////////////////////////
  function loadVideoPlayer() {
    const player = new window.YT.Player("player", {
      height: "390",
      width: "640",
      playerVars: { autoplay: 0 },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
      },
    });
    youtubePlayer.current = player;
  }
  function onPlayerReady(e) {}
  function onPlayerStateChange(event) {
    const val = event.data;
    if (val == 1) {
      videoState.current = "play";
      sendMsg("play");
    } else if (val == 2) {
      videoState.current = "pause";
      sendMsg("pause");
    }
  }
  function loadVideo() {
    videoState.current = "newVideo";
    sendMsg("newVideo");
    youtubePlayer.current.loadVideoById(videoID.split("=")[1]);
  }
  return (
    <div className={classes.root}>
      <h1 style={{ color: "#ffffff" }}>
        Room ID is {props.match.params.roomID}
      </h1>
      <Grid item xs={12}>
        <div style={{ alignContent: "center" }} id="player"></div>
      </Grid>
      <input
        type="text"
        placeholder="video link"
        value={videoID}
        onChange={(e) => setVideoID(e.target.value)}
      />
      <button onClick={loadVideo}>Load video</button>
      <Videos streams={peersVideo} userVideo={userVideo}></Videos>
    </div>
  );
};

export default Room;
