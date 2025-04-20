import { Client, Account } from "appwrite";

const client = new Client()
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT!) // Your API Endpoint
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT!);                 // Your project ID

const account = new Account(client);

const promise = account.createAnonymousSession();

promise.then(function (response) {
    console.log(response); // Success
}, function (error) {
    console.log(error); // Failure
});
