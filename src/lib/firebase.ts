import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyBc8EabLQQzZ316UKj_NUT3pF4LQ6wTTIw",
  authDomain: "parkicare-my.firebaseapp.com",
  projectId: "parkicare-my",
  storageBucket: "parkicare-my.firebasestorage.app",
  messagingSenderId: "4346064972",
  appId: "1:4346064972:web:381469c1c0c316793084e9",
};

const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);
