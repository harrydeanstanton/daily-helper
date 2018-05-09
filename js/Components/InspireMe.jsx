import React from 'react';

export class InspireMe extends React.Component {
    constructor(props) {
        super(props);
        this.state = {

            quotez: []
        }
    }


    newQuote = () => {
        fetch('https://favqs.com/api/qotd').then(results => results.json()).then(data => {
            let arrayOfQtes = [];
            arrayOfQtes.push(data);
            this.setState({
                quotez: arrayOfQtes
            });
        })
    };

    componentDidMount() {
        this.newQuote()
    }

    getNewQuote=(e)=>{
        e.preventDefault();
        this.newQuote()


    }

    render() {

        console.log(this.state.quotez);
        return (
            <div>
                {this.state.quotez.map(qt => <span key={qt.quote.id}>{qt.quote.body} <span>{qt.quote.author}</span></span>)}
                <br/>
                <button onClick={this.getNewQuote}>Inspire Me!</button>


            </div>
        )
    }
}