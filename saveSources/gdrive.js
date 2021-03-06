core.registerSaveSource("gd", function () { // Google drive save source - just thinly veiled firebase save source XD
  let me = this;
  me.unsub = {};
  let CLIENT_ID = '894862693076-kke1dsjjetpauijldeb29ji5r2ha3n5a.apps.googleusercontent.com';
  let API_KEY = 'AIzaSyA-sH4oDS4FNyaKX48PSpb1kboGxZsw9BQ';

  // Array of API discovery doc URLs for APIs used by the quickstart
  var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
  var SCOPES = 'https://www.googleapis.com/auth/drive.install https://www.googleapis.com/auth/drive.file';

  this.continueLoad=function (ready){
    if (ready){
      //continue to load as if we were just in firebase
    }else{
      //reshow privacy policy and prompt (just cry for now)
      return;
    }
  }

  try {
    firebase.initializeApp({
      apiKey: "AIzaSyA-sH4oDS4FNyaKX48PSpb1kboGxZsw9BQ",
      authDomain: "backbits-567dd.firebaseapp.com",
      databaseURL: "https://backbits-567dd.firebaseio.com",
      projectId: "backbits-567dd",
      storageBucket: "backbits-567dd.appspot.com",
      messagingSenderId: "894862693076"
    });
  } catch (e) {
    console.log(e);
  }try{
    this.db = firebase.firestore();
    me.db.settings({
      timestampsInSnapshots: true
    });
  }catch(e){

  }
  this.pushAll = async function (id, data) {
    //dont actually do anything here... this is a ctrl s by the user.
  }
  this.pullAll = async function (id) {
    return new Promise(function(resolve,reject){
      async function continueLoad(){
        if (!this.db) return;
        let root = this.db
          .collection("polymorph")
          .doc(id);
        //load items; load views, package, send
        let result = {
          views: {},
          items: {}
        };
        let snapshot = await root.collection("views").get();
        snapshot.forEach((doc) => {
          result.views[doc.id] = doc.data();
        });
        snapshot = await root.collection("items").get();
        snapshot.forEach((doc) => {
          result.items[doc.id] = doc.data();
        })
        //meta properties
        snapshot = await root.get();
        Object.assign(result, snapshot.data());
        resolve(result);
      }
      scriptassert([
        ["googledriveapi", "https://apis.google.com/js/api.js"]
      ], () => {
        gapi.load('client:auth2', () => {
          gapi.client.init({
            apiKey: API_KEY,
            clientId: CLIENT_ID,
            discoveryDocs: DISCOVERY_DOCS,
            scope: SCOPES
          }).then(function () {
            // Listen for sign-in state changes.
            gapi.auth2.getAuthInstance().isSignedIn.listen(continueLoad);
    
            // Handle the initial sign-in state.
            if (!gapi.auth2.getAuthInstance().isSignedIn.get()){
              //start the signin process!
              gapi.auth2.getAuthInstance().signIn();
            }else{
              continueLoad(true);
            }
            
            
          }, function (error) {
            reject("User did not authenticate");
          });
        });
    
      });
    })
  }

  this.hook = async function (id) { // just comment out if you can't subscribe to live updates.
    let root = this.db
      .collection("polymorph")
      .doc(id);
    // remote
    //items
    me.unsub['items'] = root.collection("items").onSnapshot(shot => {
      shot.docChanges().forEach(change => {
        if (change.doc.metadata.hasPendingWrites) return;
        switch (change.type) {
          case "added":
          case "modified":
            core.items[change.doc.id] = change.doc.data();
            //dont double up local updates
            me.localChange = true;
            core.fire("updateItem", {
              id: change.doc.id
            });
            break;
          case "removed":
            localChange = true;
            core.fire("deleteItem", {
              id: change.doc.id,
              forced: true // not yet implemented but ill figure it out
            });
            break;
        }
      })
    });
    //views
    me.unsub['views'] = root.collection("views").onSnapshot(shot => {
      shot.docChanges().forEach(change => {
        if (change.doc.metadata.hasPendingWrites) return;
        switch (change.type) {
          case "added":
          case "modified":
            core.currentDoc.views[change.doc.id] = change.doc.data();
            break;
          case "removed":
            delete core.currentDoc.views[change.doc.id];
            break;
        }
      })
    });
    //meta
    me.unsub["settings"] = root.onSnapshot(shot => {
      //copy over the settings and apply them
      if (!shot.metadata.hasPendingWrites) {
        if (shot.data()) {
          Object.assign(core.currentDoc, shot.data());
          me.localChange = true;
          core.updateSettings();
        }
      }
    });

    //local to remote
    //items
    me.itemcapacitor = new capacitor(500, 30, (id) => {
      root.collection('items').doc(id).set(JSON.parse(JSON.stringify(core.items[id])));
    })
    core.on("updateItem", (d) => {
      if (me.localChange) me.localChange = false;
      else {
        me.itemcapacitor.submit(d.id);
      }
    });
    //views
    me.viewcapacitor = new capacitor(500, 30, () => {
      root.collection('views').doc(core.currentDoc.currentView).set(JSON.parse(JSON.stringify(core.baseRect.toSaveData())));
    })
    core.on("updateView", (d) => {
      me.viewcapacitor.submit(d.id);
    });
    //meta
    core.on("updateDoc", () => {
      if (me.localChange) me.localChange = false;
      else {
        let copyobj = Object.assign({}, core.currentDoc);
        delete copyobj.items;
        delete copyobj.views;
        root.set(copyobj);
      }
    });
  }
  this.unhook = async function (id) { // just comment out if you can't subscribe to live updates.
    for (i in me.unsub) {
      me.unsub[i]();
    }
  }
})