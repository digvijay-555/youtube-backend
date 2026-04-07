import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { upload } from '../middlewares/multer.middleware.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { User } from '../models/users.model.js';
import pkg from 'jsonwebtoken';
const jwt = pkg;

//NOTE: In login user controller we need to update the generated refresh token in the database if needed.

const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();
        
        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});

        return {accessToken, refreshToken};
    } catch (error) {
        throw new ApiError(500, "Token generation failed");
    }
}

const registerUser = asyncHandler(async (req, res) =>{
    const {fullName, email, username, password} = req.body;
    

    if(!fullName || !email || !username || !password){
        throw new ApiError( 400, "All fields are required");
    }

    console.log("Registration request body: ", req.body);
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
        coverImage: coverImage ? coverImage.url : null,
        refreshToken: undefined
    });

    // user.refreshToken = user.generateRefreshToken();
    // await user.save({validateBeforeSave: false});

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


const loginUser = asyncHandler(async (req, res) => {
    // console.log("Login request body: ", req.body);
    const {email, username, password} = req.body;

    if(!username && !email){
        throw new ApiError(400, "Username or email is required");
    }

    //console.log("Login request body: ", req.body);
    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        //console.log("User not found with username or email: ", username, email);
        throw new ApiError(404, "User not found");
    }
    //console.log("User found: ", user);

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        console.log("Invalid credentials for user: ", username, email);
        throw new ApiError(401, "Invalid credentials");
    }
    //console.log("Credentials are valid for user: ", username, email);
    
    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id);
    console.log("Generated tokens: ", {accessToken, refreshToken});

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
    //console.log("Logged in user: ", loggedInUser);
    const options = {
        httpOnly: true,
        secure: true
    }


    return res
    .status(201)
    .cookie("refreshToken", refreshToken, options)
    .cookie("accessToken", accessToken, options)
    .json(
        "User logged in successfully"
    )
})

const logoutUser = asyncHandler(async (req, res) => { 
    User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("refreshToken", options)
    .clearCookie("accessToken", options)
    .json("User logged out successfully")
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    
        const user = await User.findById(decodedToken._id);
    
        if(!user){
            throw new ApiError(401, "Unauthorized request");
        }
    
        if(incomingRefreshToken !== user.refreshToken){
            throw new ApiError(401, "Unauthorized request");
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id);
        
        return res
        .status(200)
        .cookie("refreshToken", newRefreshToken, options)
        .cookie("accessToken", accessToken, options)
        .json("Access token refreshed successfully")
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
})

const changeCurrentPassword = asyncHandler(async(req, res) =>{
    const {oldPassword, newPassword} = req.body;

    const user = await User.findById(req.user._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if(!isPasswordCorrect){
        throw new ApiError(400, "Old password is incorrect");
    }

    user.password = newPassword;
    await user.save({validateBeforeSave: false});

    return res
    .status(200)
    .json("Password changed successfully");
    
})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(req.user);

})

const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar image is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    
    if(!avatar.url){
        throw new ApiError( 400, "Error while uploading avatar",);
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {
            new: true
        }
    ).select("-password");

    return res
    .status(200)
    .json(user);
})

const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path;

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover image is required");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    
    if(!coverImage.url){
        throw new ApiError( 400, "Error while uploading cover image",);
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {
            new: true
        }
    ).select("-password");

    return res
    .status(200)
    .json(user);
})

const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params;

    if(!username?.trim()){
        throw new ApiError(400, "Username is required");
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: " subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: { $size: "$subscribers" },
                channelsSubscribedToCount: { $size: "$subscribedTo" },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])
    
    if(!channel || channel.length === 0){
        throw new ApiError(404, "Channel not found");
    }

    return res
    .status(200)
    .json(channel[0]);
})


const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: req.user._id
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup:{
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                },
                                {
                                    $addFields: {
                                        owner:{
                                            $first: "$owner"
                                        }
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        }
    ]);

    return res
    .status(200)
    .json(new ApiResponse(200, user[0].watchHistory, "Watch history fetched successfully"));
})


export {registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateUserAvatar, updateUserCoverImage, getUserChannelProfile, getWatchHistory};