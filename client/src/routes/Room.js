import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";

const Video = (props) => {
  const ref = useRef();

  useEffect(() => {
    ref.current.srcObject = props.video;
    console.log(ref);
  }, []);

  return console.log(ref) && <video playsInline autoPlay ref={ref} />;
};
const Room = (props) => {
  const userVideo = useRef();
  const peersVideo = useRef([]);
  //const peerRef = useRef();
  const partnerVideo = useRef();
  const socketRef = useRef();
  const otherUser = useRef();
  const userStream = useRef();
  const [peers, setPeers] = useState([]);
  const peersRef = useRef({});
  const roomID = props.match.params.roomID;

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((stream) => {
        userVideo.current.srcObject = stream;
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
        });

        socketRef.current.on("user joined", (userID) => {
          otherUser.current = userID;
        });

        socketRef.current.on("offer", handleRecieveCall);

        socketRef.current.on("answer", handleAnswer);

        socketRef.current.on("ice-candidate", handleNewICECandidateMsg);
      });
  }, []);

  function callUser(userID) {
    const peer = createPeer(userID);
    peersRef.current[userID] = peer;
    userStream.current
      .getTracks()
      .forEach((track) =>
        peersRef.current[userID].addTrack(track, userStream.current)
      );
    return peer;
  }

  function createPeer(userID) {
    const peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.stunprotocol.org",
        },
        {
          urls: "turn:numb.viagenie.ca",
          credential: "muazkh",
          username: "webrtc@live.com",
        },
      ],
    });

    peer.onicecandidate = handleICECandidateEvent;
    peer.ontrack = (e) => handleTrackEvent(e, userID);
    peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userID);

    return peer;
  }

  function handleNegotiationNeededEvent(userID) {
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
    setPeers((users) => [...users, peersRef.current[callerID]]);
  }

  function handleAnswer(message) {
    const desc = new RTCSessionDescription(message.sdp);
    peersRef.current[message.caller]
      .setRemoteDescription(desc)
      .catch((e) => console.log(e));
  }

  function handleICECandidateEvent(e) {
    if (e.candidate) {
      const payload = {
        caller: socketRef.current.id,
        target: otherUser.current,
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

  function handleTrackEvent(e) {
    //console.log(e.streams[0]);
    //peersVideo.current.push(e.streams[0]);
    partnerVideo.current.srcObject = e.streams[0];
  }

  return (
    <div>
      <h1>{props.match.params.roomID}</h1>
      <video autoPlay ref={userVideo} />
      <video autoPlay ref={partnerVideo} />
      {/* {peersVideo.current.map((video, index) => {
        const vid = useRef();
        vid.current.srcObject = video;
        return <video autoPlay ref={vid} />;
      })} */}
    </div>
  );
};

export default Room;
