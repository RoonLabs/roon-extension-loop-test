# roon-extension-loop-test

This is a simple extension to force an output in Roon to always be playing.  It subscribes to the transport service, and
sends a 'play' command if it ever sees a message indicating that the selected output is in a stopped or paused state.

To use:
1. git clone git@github.com:RoonLabs/roon-extension-loop-test.git
2. cd roon-extension-loop-test
3. npm install
4. node app.js
5. open Roon, go to settings -> extensions -> Loop test settings -> select the output you would like to play

Note that the only ways to stop that output once it has been started is to either disable it in Roon or shut down the extension.  The Roon pause/stop buttons will not work.
