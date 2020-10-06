import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";

const Videos = (props) => {
  function setSrcObject(ref, stream) {
    if (ref) {
      ref.srcObject = stream;
    }
  }
  return (
    <div>
      {props.streams.map((stream) => (
        <video inline ref={(ref) => setSrcObject(ref, stream)} autoPlay />
      ))}
    </div>
  );
};
const Room = (props) => {
  const userVideo = useRef();
  const [peersVideo, setPeersVideo] = useState([]);
  const socketRef = useRef();
  const userStream = useRef();
  const [peers, setPeers] = useState([]);
  const peersRef = useRef({});
  const dataChannel = useRef({});
  const videoShow = useRef({});
  const roomID = props.match.params.roomID;
  const [msg, setMsg] = useState("");
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
          const peers = [];
          users.forEach((userID) => {
            const peer = callUser(userID);
            peers.push(peer);
          });
          setPeers(peers);
          console.log(peers);
        });

        socketRef.current.on("user joined", (userID) => {});

        socketRef.current.on("offer", handleRecieveCall);

        socketRef.current.on("answer", handleAnswer);

        socketRef.current.on("ice-candidate", handleNewICECandidateMsg);
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
    peersRef.current[userID] = peer;
    dataChannel.current[userID] = createChannel(userID);
    userStream.current.getTracks().forEach((track) => {
      console.log(track);
      peersRef.current[userID].addTrack(track, userStream.current);
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
    return peer;
  }
  function createChannel(userID) {
    const channel = peersRef.current[userID].createDataChannel("Data Chn");
    console.log(channel);
    channel.onmessage = (e) => handleMessage(e, userID);
    return channel;
  }
  function handleNegotiationNeededEvent(userID) {
    console.log("HANDLING NEGOTIATION EVENT WITH " + userID);
    peersRef.current[userID]
      .createOffer()
      .then((offer) => {
        return peersRef.current[userID].setLocalDescription(offer);
      })
      .then(() => {
        const payload = {
          target: userID,
          caller: socketRef.current.id,
          sdp: peersRef.current[userID].localDescription,
        };
        console.log(payload);
        socketRef.current.emit("offer", payload);
      })
      .catch((e) => console.log(e));
  }

  function handleRecieveCall(incoming) {
    console.log("HANDLING RECIEVE CALL FROM " + incoming.caller);
    const callerID = incoming.caller;
    peersRef.current[callerID] = createPeer(callerID);
    console.log(callerID);
    console.log(peersRef.current[callerID]);
    const desc = new RTCSessionDescription(incoming.sdp);
    console.log(desc);
    peersRef.current[callerID]
      .setRemoteDescription(desc)
      .then(() => {
        userStream.current
          .getTracks()
          .forEach((track) =>
            peersRef.current[callerID].addTrack(track, userStream.current)
          );
      })
      .then(() => {
        return peersRef.current[callerID].createAnswer();
      })
      .then((answer) => {
        return peersRef.current[callerID].setLocalDescription(answer);
      })
      .then(() => {
        const payload = {
          target: incoming.caller,
          caller: socketRef.current.id,
          sdp: peersRef.current[callerID].localDescription,
        };
        socketRef.current.emit("answer", payload);
      });
    setPeers((peers) => [...peers, peersRef.current[callerID]]);
  }

  function handleAnswer(message) {
    const desc = new RTCSessionDescription(message.sdp);
    peersRef.current[message.caller]
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

    peersRef.current[incoming.caller]
      .addIceCandidate(candidate)
      .catch((e) => console.log(e));
  }

  function handleTrackEvent(e, userID) {
    console.log(e);
    console.log(e.streams[0].getTracks());
    console.log(userID);
    if (videoShow.current[userID] == null) {
      let remoteStream = e.streams[0];
      setPeersVideo((remoteStreams) => [...remoteStreams, remoteStream]);
      videoShow.current[userID] = userID;
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
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
      },
    });
    youtubePlayer.current = player;
  }
  function onPlayerReady() {
    //NOTHING TO DO FOR NOW;
  }
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
    <div>
      <h1>{props.match.params.roomID}</h1>
      <div id="player"></div>
      <video className="selfVideo" autoPlay ref={userVideo} muted />
      <Videos streams={peersVideo}></Videos>
      <input
        type="text"
        placeholder="video link"
        value={videoID}
        onChange={(e) => setVideoID(e.target.value)}
      />
      <button onClick={loadVideo}>Load video</button>
    </div>
  );
};

export default Room;
