// import {v2 as cloudinary} from 'cloudinary';
// import fs from 'fs';

//  cloudinary.config({
//     cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//     api_key: process.env.CLOUDINARY_API_KEY,
//     api_secret: process.env.CLOUDINARY_API_SECRET
//  });

// const uploadOnCloudinary = async (localFilePath) => {
//     try {
//         if(!localFilePath) return null;

//         const response = await cloudinary.uploader.upload(localFilePath, {
//             resource_type: "auto"
//         })

//         console.log("file uploaded successfully.", response.url);
//         return response;

//     } catch (error) {
//         fs.unlinkSync(localFilePath); // remove the locally saved temporary file
//         return null; 
//     }
//  }


// export {uploadOnCloudinary}

import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;

        if (!fs.existsSync(localFilePath)) {
            console.error("File does not exist:", localFilePath);
            return null;
        }

        // const response = await cloudinary.uploader.upload(localFilePath, {
        //     resource_type: "auto"
        // });

        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
            timeout: 60000
        });

        // delete local file after upload
        fs.unlink(localFilePath, (err) => {
            if (err) console.error("File delete error:", err);
        });

        console.log("File uploaded successfully:", response.secure_url);

        return {
            url: response.secure_url,
            public_id: response.public_id
        };

    } catch (error) {
        console.error("Cloudinary upload failed:", error);

        fs.unlink(localFilePath, (err) => {
            if (err) console.error("File delete error:", err);
        });

        return null;
    }
};

export { uploadOnCloudinary };