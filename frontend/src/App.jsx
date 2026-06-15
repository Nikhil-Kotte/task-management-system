import { BrowserRouter, Routes, Route, Navigate} from 'react-router-dom';
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Tasks from "./pages/Tasks.jsx";
import Profile from "./pages/Profile.jsx";

function RequireAuth({children}){
  const token= localStorage.getItem("token");

  return token ? children : <Navigate to= "/login" replace/>;
}

export default function App(){
  return(
    <BrowserRouter>
      <Routes>
        <Route path="/login" element ={<Login/>}/>
        <Route path="/register" element = {<Register/>}/>
        <Route path="/tasks" element = {<RequireAuth><Tasks/></RequireAuth>}/>
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="*" element = {<Navigate to="/login" replace/>}/>
      </Routes>
    </BrowserRouter>
  )
}

