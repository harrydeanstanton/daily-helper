import React from 'react';
import {InspireMe} from './InspireMe.jsx'

export class ToDoList extends React.Component {

    constructor(props){
        super(props);
        this.state={
            task: '',
            items: []
        }
    }


    render(){
        return(
            <div>
                <InspireMe/>



            </div>
        )
    }
}