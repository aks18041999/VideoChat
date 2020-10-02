import React, { Component } from "react";
import { v1 as uuid } from "uuid";

const CreateRoom = (props) => {
  const [roomID, setRoomID] = React.useState("");
  function create() {
    const id = uuid();
    props.history.push(`/room/${id}`);
  }
  function joinRoom() {
    props.history.push(`/room/${roomID}`);
  }
  return (
    <div>
      <button onClick={create}>Create Room</button>
      <input
        type="text"
        placeholder="room id"
        value={roomID}
        onChange={(e) => setRoomID(e.target.value)}
      />
      <button onClick={joinRoom}>Join Room</button>
    </div>
  );
};

export default CreateRoom;
