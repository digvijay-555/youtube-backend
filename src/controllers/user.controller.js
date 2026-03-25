import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { upload } from '../middlewares/multer.middleware.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { User } from '../models/users.model.js';


const registerUser = asyncHandler(async (req, res) =>{
    const {fullName, email, username, password} = req.body;
    console.log("email: ", email);

    if(!fullName || !email || !username || !password){
        throw new ApiError( 400, "All fields are required");
    }

    // const existingUser = await User.findOne({
    //     $or: [{ username }, { email }]
    // });
    
    // if(existingUser){
    //     throw new ApiError("Username or email already exists", 400);
    // }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar image is required");
    }
    console.log("avatarLocalPath: ", avatarLocalPath);
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = coverImageLocalPath ? await uploadOnCloudinary(coverImageLocalPath) : null;

    if(!avatar){
        throw new ApiError( 400, "Avatar file is required",);
    }

    const user = await User.create({
        fullName,
        email,
        username: username.toLowerCase(),
        password,
        avatar: avatar.url,
        coverImage: coverImage ? coverImage.url : null
    });

    const createdUser = await User.findById(user._id).select("-password -refreshToken ");
    console.log("createdUser: ", createdUser);

    if(!createdUser) {
        throw new ApiError(500, "User registration failed");
    }

    //res.status(201).json(new ApiResponse(201, createdUser, "User registered successfully"));
    res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: createdUser
    });
})  

export {registerUser}