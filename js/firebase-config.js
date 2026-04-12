// FideliAI — Firebase Configuration
// Replace with your Firebase project credentials

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "fideliai-app.firebaseapp.com",
    projectId: "fideliai-app",
    storageBucket: "fideliai-app.appspot.com",
    messagingSenderId: "000000000000",
    appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

export { auth, db, firebase };
