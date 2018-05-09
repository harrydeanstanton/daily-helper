import React from 'react';
import {ToDoList} from "./ToDoList.jsx";
import {Game} from "./Game.jsx";
import {Gifs} from "./Gifs.jsx";
import {Header} from "./Header.jsx";
import {Menu} from "./Menu.jsx";
import {Footer} from "./Footer.jsx"
import {
    HashRouter,
    Route,
    Link,
    Switch,
    NavLink,
} from 'react-router-dom';



export class Index extends React.Component{

    render(){
        return(
            <HashRouter>
                <div>
                    <Header>
                        <Menu/>
                    </Header>
                    <Switch>
                        <Route exact path="/" component ={ToDoList}/>
                        <Route path ="/game" component = {Game}/>
                        <Route path ="/gifs" component = {Gifs}/>
                    </Switch>
                    <Footer/>
                </div>
            </HashRouter>
        )
    }
}