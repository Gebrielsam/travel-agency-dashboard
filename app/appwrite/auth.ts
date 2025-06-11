// @ts-ignore

import {account, appwriteConfig, database} from "~/appwrite/client";
import {ID, OAuthProvider, Query} from "appwrite";
import {redirect} from "react-router";

export const loginWithGoogle = async () => {
    try {
        account.createOAuth2Session(OAuthProvider.Google)
    } catch (e) {
        console.log('loginWithGoogle', e);
    }
};

export const getUser = async () => {
    try {
        const user = await account.get();

        if(!user) return redirect('/sign-in');

        const { documents } = await database.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.userCollectionId,
            [
                Query.equal('accountId', user.$id),
                Query.select(['name', 'email', 'imageUrl', 'joinedAt', 'accountId'])
            ]
        );

        // If user exists in database
        if (documents.length > 0) {
            const existingUser = documents[0];

            // If user doesn't have an image URL, try to get it from Google
            if (!existingUser.imageUrl) {
                const googlePhotoUrl = await getGooglePicture();
                if (googlePhotoUrl) {
                    // Update the user's image URL in the database
                    await database.updateDocument(
                        appwriteConfig.databaseId,
                        appwriteConfig.userCollectionId,
                        existingUser.$id,
                        { imageUrl: googlePhotoUrl }
                    );
                    existingUser.imageUrl = googlePhotoUrl;
                }
            }

            return existingUser;
        }

        // If user doesn't exist in database, get Google profile photo and return user data
        const googlePhotoUrl = await getGooglePicture();

        return {
            accountId: user.$id,
            name: user.name,
            email: user.email,
            imageUrl: googlePhotoUrl || '',
            joinedAt: user.$createdAt,
        };
    } catch (e) {
        console.log('getUser', e);
        return null;
    }
};

export const logoutUser = async () => {
    try {
        // Delete the current session
        await account.deleteSession('current');
        return true;
    } catch (e) {
        console.log('logoutUser error:', e);
        return false;
    }
};

export const getGooglePicture = async () => {
    try {
        // Get the current user session which contains OAuth tokens
        const session = await account.getSession('current');

        if (!session || !session.provider || session.provider !== 'google') {
            console.log('No active Google session found');
            return null;
        }

        // Get the OAuth2 token from the session
        const oAuthToken = session.providerAccessToken;

        if (!oAuthToken) {
            console.log('No OAuth token available');
            return null;
        }

        // Make a request to the Google People API to get the profile photo
        const response = await fetch(
            'https://people.googleapis.com/v1/people/me?personFields=photos',
            {
                headers: {
                    'Authorization': `Bearer ${oAuthToken}`
                }
            }
        );

        if (!response.ok) {
            console.log('Failed to fetch profile from Google People API:', response.statusText);
            return null;
        }

        const data = await response.json();

        // Extract the profile photo URL from the response
        if (data.photos && data.photos.length > 0) {
            // Return the URL of the first photo (usually the profile photo)
            return data.photos[0].url;
        }

        console.log('No profile photo found in Google People API response');
        return null;
    } catch (e) {
        console.log('Error fetching Google profile picture:', e);
        return null;
    }
};

export const storeUserData = async () => {
    try {
        // Get the current user
        const currentAccount = await account.get();

        if (!currentAccount) {
            throw new Error('User not authenticated');
        }

        // Check if user already exists in the database
        const { documents } = await database.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.userCollectionId,
            [Query.equal('accountId', currentAccount.$id)]
        );

        // If user already exists, return the existing user
        if (documents.length > 0) {
            return documents[0];
        }

        // Get the Google profile photo URL
        const googlePhotoUrl = await getGooglePicture();

        // Create a new user document
        const newUser = await database.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.userCollectionId,
            ID.unique(),
            {
                accountId: currentAccount.$id,
                name: currentAccount.name,
                email: currentAccount.email,
                imageUrl: googlePhotoUrl || '',
                joinedAt: new Date().toISOString(),
            }
        );

        return newUser;
    } catch (e) {
        console.log('storeUserData error:', e);
        throw e;
    }
};

export const getExistingUser = async () => {
    try {
        // Get the current user
        const currentAccount = await account.get();

        if (!currentAccount) {
            return null;
        }

        // Check if user exists in the database
        const { documents } = await database.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.userCollectionId,
            [
                Query.equal('accountId', currentAccount.$id),
                Query.select(['name', 'email', 'imageUrl', 'joinedAt', 'accountId'])
            ]
        );

        // If user exists, return the user data
        if (documents.length > 0) {
            const existingUser = documents[0];

            // If user doesn't have an image URL, try to get it from Google
            if (!existingUser.imageUrl) {
                const googlePhotoUrl = await getGooglePicture();
                if (googlePhotoUrl) {
                    // Update the user's image URL in the database
                    await database.updateDocument(
                        appwriteConfig.databaseId,
                        appwriteConfig.userCollectionId,
                        existingUser.$id,
                        { imageUrl: googlePhotoUrl }
                    );
                    existingUser.imageUrl = googlePhotoUrl;
                }
            }

            return existingUser;
        }

        return null;
    } catch (e) {
        console.log('getExistingUser error:', e);
        return null;
    }
};
