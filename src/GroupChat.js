import React, { Component } from "react";
import { Container, Row, Col, Button, Form, Figure } from "react-bootstrap";
import { Player, ControlBar } from "video-react";

import Peer from "simple-peer";
import axios from "axios";
import Masonry from "react-masonry-component";

// const BASE_URL = "https://electron-videochat-authserver-gqxyymxnrs.now.sh";
//const BASE_URL = "http://192.168.0.153:5000";
const BASE_URL = "https://server.bibinprathap.now.sh";
class GroupChatScreen extends Component {
  state = {
    is_initialized: false,
    streams: [],
    username: ""
  };

  constructor(props) {
    super();
    this.users = [];
    this.user_channels = [];
    this.peers = [];
    this.is_initiator = false;
    this.peer_username = null;
    this.has_own_stream = false;
    this.shimCreateObjectURL(window);
    this.shimGetUserMedia(window);
  }

  _connectToPeer = (username, stream = false) => {
    const peer_options = {
      initiator: this.is_initiator,
      trickle: false
    };

    if (stream) {
      peer_options.stream = stream;
    }

    const p = new Peer(peer_options);

    this.peers.push({
      username: username,
      peer: p
    });

    p.on("error", err => {
      console.log("peer error: ", err);
    });

    p.on("signal", data => {
      debugger;
      if (this.is_initiator && data) {
        console.log("(4) user A receives signal");
        this.signal = JSON.stringify(data);
      } else {
        console.log("(8) user B generates an answer");

        const peer = this.user_channels.find(ch => {
          return ch.username === this.peer_username;
        });
        if (peer) {
          console.log(
            "(9) user B triggers event (client-peer-data) containing the answer to user A"
          );

          peer.channel.trigger("client-peer-data", {
            username: this.username,
            peer_data: JSON.stringify(data)
          });
        }
      }
    });

    p.on("connect", () => {
      console.log(`(10) ${this.username} is connected`);

      this.users.shift();

      if (this.users.length) {
        this._initializePeerConnection(this.users[0]);
      }
    });

    p.on("stream", stream => {
      console.log(`${this.username} received stream`);
      const peer_video_stream = window.URL.createObjectURL(stream);

      this.setState(prevState => ({
        streams: [...prevState.streams, peer_video_stream]
      }));
    });

    p.on("data", data => {
      //console.log(ab2str(data));
    });
  };
  shimCreateObjectURL = (window) => {
    var URL = window && window.URL;
    if (!(typeof window === "object" && window.HTMLMediaElement && "srcObject" in window.HTMLMediaElement.prototype && URL.createObjectURL && URL.revokeObjectURL)) {
      return undefined;
    }
    var nativeCreateObjectURL = URL.createObjectURL.bind(URL);
    var nativeRevokeObjectURL = URL.revokeObjectURL.bind(URL);
    var streams = new Map, newId = 0;
    URL.createObjectURL = function (stream) {
      if ("getTracks" in stream) {
        var url = "polyblob:" + ++newId;
        streams.set(url, stream);
        // utils.deprecated("URL.createObjectURL(stream)", "elem.srcObject = stream");
        return url;
      }
      return nativeCreateObjectURL(stream);
    };
    URL.revokeObjectURL = function (url) {
      nativeRevokeObjectURL(url);
      streams.delete(url);
    };
    var dsc = Object.getOwnPropertyDescriptor(window.HTMLMediaElement.prototype, "src");
    Object.defineProperty(window.HTMLMediaElement.prototype, "src", {
      get: function () {
        return dsc.get.apply(this);
      }, set: function (url) {
        this.srcObject = streams.get(url) || null;
        return dsc.set.apply(this, [url]);
      }
    });
    var nativeSetAttribute = window.HTMLMediaElement.prototype.setAttribute;
    window.HTMLMediaElement.prototype.setAttribute = function () {
      if (arguments.length === 2 && ("" + arguments[0]).toLowerCase() === "src") {
        this.srcObject = streams.get(arguments[1]) || null;
      }
      return nativeSetAttribute.apply(this, arguments);
    };
  }

  shimGetUserMedia = (window) => {
    var navigator = window && window.navigator;
    if (!navigator.getUserMedia) {
      if (navigator.webkitGetUserMedia) {
        navigator.getUserMedia = navigator.webkitGetUserMedia.bind(navigator);
      } else {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          navigator.getUserMedia = function (constraints, cb, errcb) {
            navigator.mediaDevices.getUserMedia(constraints).then(cb, errcb);
          }.bind(navigator);
        }
      }
    }
  }

  _createPeer = username => {
    navigator.getUserMedia(
      { video: true, audio: true },
      stream => {
        const video_stream = window.URL.createObjectURL(stream);

        if (!this.has_own_stream) {
          this.setState(prevState => ({
            streams: [...prevState.streams, video_stream]
          }));
          this.has_own_stream = true;
        }

        console.log(`${this.username} is connecting to remote peer...`);
        this._connectToPeer(username, stream);
      },
      err => {
        console.log("error occured getting media: ", err);
      }
    );
  };

  async componentDidMount() {
    const { pusher, username, my_channel, channel } = this.props;
    this.username = username;
    this.channel = channel;
    this.pusher = pusher;
    this.my_channel = my_channel;

    try {
      const response_data = await axios.post(`${BASE_URL}/users`, {
        channel: this.channel,
        username: this.username
      });

      this.users = response_data.data.users;
      if (this.users.length) {
        this._initializePeerConnection(this.users[0]);
      }
    } catch (err) {
      console.log("error getting users: ", err);
    }

    // (3) user A receives event (client-initiate-signaling) from user B and setups peer connection
    this.my_channel.bind("client-initiate-signaling", data => {
      console.log(
        "(3) user A receives event (client-initiate-signaling) from user B and setups peer connection"
      );
      this.is_initiator = true; // whoever receives the client-initiate-signaling is the initiator
      this._createPeer(data.username);

      this.initiator_channel = this.pusher.subscribe(
        `private-user-${data.username}`
      );

      this.initiator_channel.bind("pusher:subscription_error", () => {
        console.log(`error subscribing to signaling user ${data.username}`);
      });

      this.initiator_channel.bind("pusher:subscription_succeeded", () => {
        setTimeout(() => {
          if (this.signal) {
            // (5) user A triggers event (client-peer-data) containing their signal to user B
            console.log(
              "(5) user A triggers event (client-peer-data) containing their signal to user B: ",
              this.signal
            );
            this.initiator_channel.trigger("client-peer-data", {
              username: this.username,
              peer_data: this.signal
            });
          } else {
            console.log("There's no signal");
          }
        }, 5000);
      });
    });

    this.my_channel.bind("client-peer-data", data => {
      if (!this.is_initiator) {
        console.log("(6) user B receives the event (client-peer-data)");
        console.log(
          "(7) user B throws back the signal to user A via peer signaling (peer.signal)"
        );
      } else {
        console.log(
          "(10) user A receives the event (client-peer-data) and throws back the signal to user B via peer signaling (peer.signal)"
        );
      }

      const user = this.peers.find(item => {
        return item.username === data.username;
      });
      if (user && data) {
        console.log("now sending data via peer signaling: ", data);
        user.peer.signal(JSON.parse(data.peer_data));
      } else {
        console.log("cant find user / no data");
      }
    });

    this.setState({
      is_initialized: true
    });
  }

  _initializePeerConnection = username => {
    const channel = this.pusher.subscribe(`private-user-${username}`);
    this.user_channels.push({
      username,
      channel
    });

    channel.bind("pusher:subscription_error", status => {
      console.log("error subscribing to peer channel: ", status);
    });

    channel.bind("pusher:subscription_succeeded", () => {
      console.log("(1) user B setups peer connection (non initiator)");
      this.is_initiator = false;
      this._createPeer(username); // this is always the non-initiator
      this.peer_username = username;

      console.log(
        "(2) user B triggers event (client-initiate-signaling) to user A"
      );

      setTimeout(() => {
        channel.trigger("client-initiate-signaling", {
          username: this.username
        });
      }, 5000);
    });
  };

  _renderStreams = () => {
    return this.state.streams.map(video => {
      return (
        <div className="VideoBox">
          <Player autoPlay={true} src={video}>
            <ControlBar autoHide={false} disableDefaultControls />
          </Player>
        </div>
      );
    });
  };

  render() {
    return (
      <Container fluid={true}>
        {/* <Row className="Header justify-content-md-center">
          <Col md="4">
            <h3>{this.channel}</h3>
          </Col>
        </Row> */}
        {!this.state.is_initialized && <div className="loader">Loading...</div>}

        {/* <Form.Control
          type="text"
          placeholder="username"
          value={this.state.username}
          onChange={this.onTypeText}
        />

        <Button variant="primary" type="button" onClick={this._sendMessage}>
          Send Message
        </Button> */}

        {this.state.is_initialized && (
          <Row>
            <Col md={8} className="VideoContainer">
              <Masonry
                disableImagesLoaded={false}
                updateOnEachImageLoad={false}
              >
                {this._renderStreams()}
              </Masonry>
            </Col>
          </Row>
        )}
      </Container>
    );
  }

  onTypeText = evt => {
    this.setState({
      username: evt.target.value
    });
  };

  _sendMessage = () => {
    const user = this.peers.find(item => {
      return item.username === this.state.username;
    });
    if (user) {
      user.peer.send(`you received a message from ${this.username}`);
    }
  };
}

export default GroupChatScreen;