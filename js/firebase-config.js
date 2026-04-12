// FideliAI — Firebase Configuration
// Replace with your Firebase project credentials

const firebaseConfig = {
    apiKey: "AIzaSyD7kHbNv09Mg-aYfFXSMKrVdi_JqlOuQF4",
    authDomain: "fideliai-app.firebaseapp.com",
    projectId: "fideliai-app",
    storageBucket: "fideliai-app.firebasestorage.app",
    messagingSenderId: "49232775542",
    appId: "1:49232775542:web:e5e5771426462389c5d257"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

export { auth, db, firebase };
