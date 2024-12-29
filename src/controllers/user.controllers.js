import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async(req,res) => {
    //1step - get the data from users and check all the fields are valid or not
    const{fullName,email,username, password} = req.body;
    console.log("email:",email)
    // validation of fields send by user
    if(
        [fullName,email,username,password].some((field)=> field?.trim() === "")
    ){
        throw new ApiError(400 , "All fields are required")
    }
    //2nd step - check if current user is already register or not
    const existedUser = User.findOne({
        $or : [{ username }, { email }]
    })
    if(existedUser){
        throw new ApiError(400 , "User with email or username is already exist")
    }

    //check for images , check for avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }

    //upload them to cloudinary, avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!avatar){
        throw new ApiError(400,"Avatar file is required")
    }

    // if yes then return else register the user, give a success message
    // create user object and upload to db

    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        email,
        password,
        username : username.toLowerCase()
    })

    // check if user is really created or not
    const createdUser = await User.findById(user._id).select("-password -refreshToken")
    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200 , createdUser , "User registered Successfully")
    )
})

export {registerUser}