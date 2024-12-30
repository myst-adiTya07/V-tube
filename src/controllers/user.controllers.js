import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshTokens = async(userId)=>{
    try {
        const user = User.findById(userId)
        const accessToken= user.generateAccessToken
        const refreshToken = user.generateRefreshToken

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave : false})

        return {accessToken,refreshToken}

    } catch (error) {
        throw new ApiError(500 , "something went wrong while generating access and refresh token")
    }
}

const registerUser = asyncHandler(async(req,res) => {
    //1step - get the data from users and check all the fields are valid or not
    const{fullName,email,username, password} = req.body;
    // console.log("email:",email)
    // validation of fields send by user
    if(
        [fullName,email,username,password].some((field)=> field?.trim() === "")
    ){
        throw new ApiError(400 , "All fields are required")
    }
    //2nd step - check if current user is already register or not
    const existedUser = await User.findOne({
        $or : [{ username }, { email }]
    })
    if(existedUser){
        throw new ApiError(400 , "User with email or username is already exist")
    }
    // console.log(req.files)
    //check for images , check for avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

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

const loginUser = asyncHandler(async (req,res) => {
    // get data from req.body
    const {email,username,password} = req.body

    // username or email based 
    if(!username && !email){
        throw new ApiError(400,"username or email is required")
    }
    // find user in db
    const user =  await User.findOne({
        $or : [{username} , {email}]
    })

    if(!user){
        throw new ApiError(404, "User does not exist")
    }
    // check password 
    const isPasswordValid =  await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401 , "Credentials is not valid")
    }

    // generate access and refresh token
    const {accessToken,refreshToken} =  await generateAccessAndRefreshTokens(user._id)

    // send token in cookie

    const loggedInUser = User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly : true,
        secure : true
    }

    res.status(200)
    .cookie("accessToken" ,accessToken, options )
    .cookie("refreshToken",refreshToken , options)
    .json(
        new ApiResponse(
            200,
            {
                user : loggedInUser,accessToken,refreshToken
            },
            "User logged In successfully"
        )
    )
})

const logoutUser = asyncHandler(async (req,res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set : {
                refreshToken : undefined
            }
        },
        {
            new : true
        }
    )
    const options = {
        httpOnly : true,
        secure : true
    }
    return 
    res.
    status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken" , options)
    .json(new ApiResponse(200 , {} , "User logged out"))
})
export {registerUser,loginUser,logoutUser}