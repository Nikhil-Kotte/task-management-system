import axios from "axios"

const api = axios.create({baseURL:"http://localhost:5000"});

function getSavedToken(){
    return localStorage.getItem("token");
}

function addTokenToRequest(request){
    const token= getSavedToken();

    if(token){
        request.headers.Authorization='Bearer ${token}';
    }
    return request;
}

function redirectUser(){
    localStorage.removeItem("token");
    window.location.href="/login";                                                                  
}

function handleAPIError(error){
    const statusCode= error.response?.status;

    if(statusCode===401){
        redirectUser();
    }
    return Promise.reject(error);
}

api.interceptors.request.use(addTokenToRequest);
api.interceptors.response.use(
    (response) => response, handleAPIError
);

export default api;