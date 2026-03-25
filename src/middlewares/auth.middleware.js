//import { JsonWebTokenError } from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/users.model.js";
import pkg from 'jsonwebtoken';
const jwt = pkg;

export const verifyJWT = asyncHandler(async(req, res, next) =>{
    try {
        //const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
        const token = req.header("Authorization")?.replace("Bearer ", "") || req.cookies?.accessToken;

        if(!token){
            throw new ApiError(401, "Unauthorized");
        }
        console.log("Token extracted from request: ", token);
    
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        console.log("Decoded token: ", decodedToken);
    
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
    
        if(!user){
            throw new ApiError(401, "Invalid Access Token");
        }
        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(401, "Invalid Access Token");
    }
})