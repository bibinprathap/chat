import React, { Component } from "react";
import { Container, Row, Col, Form, Button } from "react-bootstrap";
import axios from "axios";
import Pusher from "pusher-js";

// import uniquename from "./helpers/uniquename";
import stringHash from "string-hash";
import GroupChat from './GroupChat'

const channel_name = 'test';

const PUSHER_APP_KEY = process.env.REACT_APP_PUSHER_APP_KEY;
const PUSHER_APP_CLUSTER = process.env.REACT_APP_PUSHER_APP_CLUSTER;
// const BASE_URL = "http://df806eff.ngrok.io";
//const BASE_URL = "http://172.20.10.2:5000";
const BASE_URL = "https://server.bibinprathap.now.sh";

class LoginScreen extends Component {
  state = {
    username: "",
    channel: channel_name,
    isLoading: false,
    showgropchat: false
  };

  constructor(props) {
    super(props);
    this.pusher = null;
    this.my_channel = null;
  }

  render() {
    const { username, channel, pusher, my_channel } = this.state;
    if (this.state.showgropchat)
      return (
        <GroupChat username={username} channel={channel} pusher={pusher} my_channel={my_channel} />
      )
    else
      return (
        <Container>
          <Row className="justify-content-md-center">
            <Col md="4" />

            <Col md={4}>
              <Form>
                <Form.Group>
                  <Form.Label>Username</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="username"
                    value={this.state.username}
                    onChange={this.onTypeText}
                  />
                </Form.Group>

                <Form.Group>
                  <Form.Label>Channel</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="channel"
                    value={this.state.channel}
                    onChange={this.onTypeText}
                  />
                  <Form.Text className="text-muted">
                    This is the name of your channel. Replace this if you want to
                    connect to an existing channel.
                </Form.Text>
                </Form.Group>

                <Button
                  variant="primary"
                  type="button"
                  onClick={this.login}
                  disabled={this.state.isLoading}
                >
                  {this.state.isLoading ? "Logging in…" : "Login"}
                </Button>
              </Form>
            </Col>

            <Col md="4" />
          </Row>
        </Container>
      );
  }

  onTypeText = evt => {
    const field = evt.target.getAttribute("placeholder");
    this.setState({
      [field]: evt.target.value
    });
  };

  login = async () => {
    const { username, channel } = this.state;
    const user_id = stringHash(username).toString();

    this.setState({
      isLoading: true
    });

    this.pusher = new Pusher(PUSHER_APP_KEY, {
      authEndpoint: `${BASE_URL}/pusher/auth`,
      cluster: PUSHER_APP_CLUSTER,
      encrypted: true
    });

    this.my_channel = this.pusher.subscribe(`private-user-${username}`);
    this.my_channel.bind("pusher:subscription_error", status => {
      console.log("error subscribing to channel: ", status);
    });

    this.my_channel.bind("pusher:subscription_succeeded", async () => {
      console.log("subscription to own channel succeeded");

      try {
        const response = await axios.post(`${BASE_URL}/login`, {
          user_id,
          username,
          channel
        });

        //if (response.statusText === "OK") {
        if (response.status === 200) {
          this.setState({
            showgropchat: true,
            isLoading: false,
            username,
            channel,
            pusher: this.pusher,
            my_channel: this.my_channel
          }
          );


        }
      } catch (e) {
        console.log("error occured logging in: ", e);
      }
    });
  };
}

export default LoginScreen;


