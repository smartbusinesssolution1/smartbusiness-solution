// service used by bank account module or any future module that needs to encrypt sensitive data 

import { createCipheriv, createDecipheriv, randomBytes } from "crypto"
import { config } from "../../config/index.js"


const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // CGM standard IV ( initialization vector) length is 12 bytes
const AUTH_TAG_LENGTH = 16; // GCM auth tag length : 16 bytes
const ENCODING = "hex";

// our encryption key is of 64 characters , in hex each byte is of 2 character ,
// so this converts it into 32 byte binary buffer required for AES-256 
const encryptionKey = Buffer.from(config.ENCRYPTION_KEY, "hex");

export class EncryptionService {

    encrypt(plainText: string): string {

        //1.generate a random 12-byte IV for this specific encryption
        const iv = randomBytes(IV_LENGTH);

        // create a cipher object
        const cipher = createCipheriv(ALGORITHM, encryptionKey, iv);

        //3.encrytp the plain text
        // cipher.update() takes the human readable string(utf-8) , feeds it to AES cipher and returns , encrypted hex string
        let encrypted = cipher.update(plainText, "utf-8", ENCODING);
        encrypted += cipher.final(ENCODING);

        //4.get the authentication tag (now when encryption is finished , cipher generates , 16-byte digital signature(authTag) representing the exact ciphertext and iv)
        const authTag = cipher.getAuthTag();

        //5.combine the IV + cipher text and the authTag and return the string to user;
        // bank_account_iv + bank_account_cipher + bank_account_auth_tag
        return `${iv.toString(ENCODING)}:${encrypted}:${authTag.toString(ENCODING)}`; // bank_account_encrypted

    }


    decrypt(encryptedText: string): string {

        //1.split the string into three components 

        const parts = encryptedText.split(":");

        if (parts.length !== 3) {
            throw new Error("Invalid encrypted data format")
        }
        // iv:cipher:authtag
        const [ivHex, ciphertext, authTagHex] = parts;

        if (!ivHex || !ciphertext || !authTagHex) {
            throw new Error("Invalid encrypted data format");
        }

        //2.reconstruct the original buffer objects
        const iv = Buffer.from(ivHex, ENCODING);
        const authTag = Buffer.from(authTagHex, ENCODING);

        //3. create a dicipher object from the same key and iv
        const decipher = createDecipheriv(ALGORITHM, encryptionKey, iv);
        decipher.setAuthTag(authTag)

        //4. decrypt the ciphertext
        let decrypted = decipher.update(ciphertext, ENCODING, "utf-8");
        decrypted += decipher.final("utf-8");

        return decrypted
    }

}

//export a singleton instance
export const encyptionService = new EncryptionService();
