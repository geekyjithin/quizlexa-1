'use strict';

const Alexa = require('alexa-sdk');
var APP_ID = undefined; // TODO replace with your app ID (OPTIONAL).

const QuizletAPI = require('quizlet-api').QuizletAPI;
var quizlet = new QuizletAPI('', '');

exports.handler = function (event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    alexa.resources = languageStrings;
    alexa.registerHandlers(entryPointHandlers,
        mainMenuHandlers,
        queryQuizletHandlers,
        confirmSingleOptionHandlers,
        confirmMultiOptionHandlers,
        setMenuHandlers);
    alexa.execute();
};

const states = {
    MAINMENU: '_MAINMENU',
    QUERYQUIZLET: '_QUERYQUIZLET',
    CONFIRMSINGLEOPTION: '_CONFIRMSINGLEOPTION',
    CONFIRMMULTIOPTION: '_CONFIRMMULTIOPTION',
    SETMENU: '_SETMENU'
};

const dataType = {
    SET: 0,
    FAVORITE: 1,
    CLASS: 2
};

const SETS_PER_PAGE = 4;

var entryPointHandlers = {
    'LaunchRequest': function () {
        var speechOutput = this.t("WELCOME_MESSAGE", this.t("SKILL_NAME"));
        var accessToken = this.event.session.user.accessToken;
        this.handler.state = states.MAINMENU;
        if (!accessToken) {
            this.emitWithState('LinkAccountIntent');
        }
        var token = parseToken(accessToken);
        quizlet.access_token = token.access_token;
        quizlet.user_id = token.user_id;
        this.emitWithState('MainMenuCommand', speechOutput);
    }
}

var mainMenuHandlers = Alexa.CreateStateHandler(states.MAINMENU, {
    'MainMenuCommand': function (prefix) {
        this.attributes['quizlet'] = undefined;
        var speechOutput = (prefix || "") + this.t("ASK_ME") + this.t("HOW_CAN_I_HELP");
        var repromptSpeech = this.t("HELP_ME");
        this.emit(':ask', speechOutput, repromptSpeech);
    },
    'SelectFavoriteSetIntent': function () {
        this.handler.state = states.QUERYQUIZLET;
        this.emitWithState('QueryFavoriteSetBranch');
    },
    'SelectSetIntent': function () {
        this.handler.state = states.QUERYQUIZLET;
        this.emitWithState('QuerySetBranch');
    },
    'LinkAccountIntent': function () {
        var accessToken = this.event.session.user.accessToken;
        if (!accessToken) {
            var speechOutput = this.t("LINK_ACCOUNT");
            this.emit(':tellWithLinkAccountCard', speechOutput);
        }
        var token = parseToken(accessToken);
        console.log('user_id: ' + token.user_id + ' access_token: ' + token.access_token);
        var speechOutput = this.t("LINKED", token.user_id, token.access_token);
        this.emit(':tell', speechOutput);
    },
    'AMAZON.RepeatIntent': function () {
        this.handler.state = states.MAINMENU;
        this.emitWithState('MainMenuCommand');
    },
    'AMAZON.CancelIntent': function () {
        var speechOutput = this.t("STOP_MESSAGE");
        this.emit(':tell', speechOutput);
    },
    'AMAZON.StopIntent': function () {
        var speechOutput = this.t("STOP_MESSAGE");
        this.emit(':tell', speechOutput);
    },
    'AMAZON.HelpIntent': function () {
        var speechOutput = this.t("HELP_MESSAGE", this.t("ASK_ME"), this.t("HOW_CAN_I_HELP"));
        this.emit(':ask', speechOutput, speechOutput);
    },
    'Unhandled': function () {
        var speechOutput = this.t("NO_UNDERSTAND");
        var repromptSpeech = this.t("HELP_ME");
        this.emit(':ask', speechOutput, repromptSpeech);
    }
});

var queryQuizletHandlers = Alexa.CreateStateHandler(states.QUERYQUIZLET, {
    'QueryFavoriteSetBranch': function () {
        quizlet.getUserFavorites()
            .then((data) => {
                if (data.length == 0) {
                    var speechOutput = this.t("NO_FAVORITES");
                    this.handler.state = states.MAINMENU;
                    this.emitWithState('MainMenuCommand', speechOutput);
                }
                this.attributes['quizlet'] = {};
                this.attributes['quizlet'].type = dataType.FAVORITE;
                this.attributes['quizlet'].data = data;
                this.attributes['quizlet'].index = 0;
                this.handler.state = states.QUERYQUIZLET;
                this.emitWithState('PaginateBranch');
            })
            .catch((err) => { console.log('error: ' + err) });
    },
    'QuerySetBranch': function () {
        quizlet.getUserSets()
            .then((data) => {
                if (data.length == 0) {
                    var speechOutput = this.t("NO_SETS");
                    this.emit(':tell', speechOutput);
                }
                this.attributes['quizlet'] = {};
                this.attributes['quizlet'].type = dataType.SET;
                this.attributes['quizlet'].data = data;
                this.attributes['quizlet'].index = 0;
                this.handler.state = states.QUERYQUIZLET;
                this.emitWithState('PaginateBranch');
            })
            .catch((err) => { console.log('error: ' + err) });
    },
    'PaginateBranch': function () {
        var length = this.attributes['quizlet'].data.length;
        if (length == 1) {
            this.handler.state = states.CONFIRMSINGLEOPTION;
            this.emitWithState('ConfirmSingleOptionCommand');
        } else {
            this.handler.state = states.CONFIRMMULTIOPTION;
            this.emitWithState('ConfirmMultiOptionCommand');
        }
    }
});

var confirmSingleOptionHandlers = Alexa.CreateStateHandler(states.CONFIRMSINGLEOPTION, {
    'ConfirmSingleOptionCommand': function () {
        var type = this.attributes['quizlet'].type;
        var speechOutput = '';
        var repromptSpeech = '';
        if (type == dataType.SET) {
            var title = this.attributes['quizlet'].data[this.attributes['quizlet'].index].title;
            speechOutput = this.t("You have one set. ")
            speechOutput += this.t("SET_NAME_IS", title) + this.t("ASK_USE_SET");
            repromptSpeech = this.t("ASK_USE_SET_REPROMPT");
        } else if (type == dataType.FAVORITE) {
            var title = this.attributes['quizlet'].data[this.attributes['quizlet'].index].title;
            speechOutput = this.t("You have one favorite set. ")
            speechOutput += this.t("SET_NAME_IS", title) + this.t("ASK_USE_SET");
            repromptSpeech = this.t("ASK_USE_SET_REPROMPT");
        }
        this.emit(':ask', speechOutput, repromptSpeech);
    },
    'AMAZON.YesIntent': function () {
        this.handler.state = states.SETMENU;
        this.emitWithState('ConfirmSetIntent');
    },
    'AMAZON.NoIntent': function () {
        this.handler.state = states.MAINMENU;
        this.emitWithState('MainMenuCommand');
    },
    'AMAZON.RepeatIntent': function () {
        this.handler.state = states.CONFIRMSINGLEOPTION;
        this.emitWithState('ConfirmSingleOptionCommand');
    },
    'AMAZON.CancelIntent': function () {
        var speechOutput = this.t("STOP_MESSAGE");
        this.emit(':tell', speechOutput);
    },
    'AMAZON.StopIntent': function () {
        var speechOutput = this.t("STOP_MESSAGE");
        this.emit(':tell', speechOutput);
    },
    'AMAZON.StartOverIntent': function () {
        this.handler.state = states.MAINMENU;
        this.emitWithState('MainMenuCommand');
    },
    'AMAZON.HelpIntent': function () {
        var speechOutput = this.t("UNDEFINED");
        this.emit(':ask', speechOutput, speechOutput);
    },
    'Unhandled': function () {
        var speechOutput = this.t("NO_UNDERSTAND");
        var repromptSpeech = this.t("HELP_ME");
        this.emit(':ask', speechOutput, repromptSpeech);
    }
});

var confirmMultiOptionHandlers = Alexa.CreateStateHandler(states.CONFIRMMULTIOPTION, {
    'ConfirmMultiOptionCommand': function () {
        var data = this.attributes['quizlet'].data;
        var index = this.attributes['quizlet'].index;
        var speechOutput = this.t("ASK_CHOOSE_SET") + "<break time=\"1s\"/>";
        for (var i = 0; i < Math.min(SETS_PER_PAGE, data.length - index); i++) {
            speechOutput += this.t("SET") + "<say-as interpret-as=\"cardinal\">" + (i + 1) + "</say-as>. " + data[i + index].title + "<break time=\"1s\"/>";
        }
        var repromptSpeech = this.t("ASK_CHOOSE_SET_REPROMPTA");
        if (data.length - index > SETS_PER_PAGE) {
            speechOutput += this.t("OR_SAY_NEXT_MORE_SETS");
            repromptSpeech += this.t("SAY_NEXT_MORE_SETS");
        }
        repromptSpeech += this.t("ASK_CHOOSE_SET_REPROMPTB");
        this.emit(':ask', speechOutput, repromptSpeech);
    },
    'SetOneIntent': function () {
        this.handler.state = states.CONFIRMMULTIOPTION;
        this.emitWithState('OneIntent');
    },
    'SetTwoIntent': function () {
        this.handler.state = states.CONFIRMMULTIOPTION;
        this.emitWithState('TwoIntent');
    },
    'SetThreeIntent': function () {
        this.handler.state = states.CONFIRMMULTIOPTION;
        this.emitWithState('ThreeIntent');
    },
    'SetFourIntent': function () {
        this.handler.state = states.CONFIRMMULTIOPTION;
        this.emitWithState('FourIntent');
    },
    'OneIntent': function () {
        this.handler.state = states.SETMENU;
        this.emitWithState('ConfirmSetIntent');
    },
    'TwoIntent': function () {
        var length = this.attributes['quizlet'].data.length;
        var index = this.attributes['quizlet'].index;
        if (length - index < 2) {
            this.handler.state = states.CONFIRMMULTIOPTION;
            this.emitWithState('Unhandled');
        }
        this.attributes['quizlet'].index += 1;
        this.handler.state = states.SETMENU;
        this.emitWithState('ConfirmSetIntent');
    },
    'ThreeIntent': function () {
        var length = this.attributes['quizlet'].data.length;
        var index = this.attributes['quizlet'].index;
        if (length - index < 3) {
            this.handler.state = states.CONFIRMMULTIOPTION;
            this.emitWithState('Unhandled');
        }
        this.attributes['quizlet'].index += 2;
        this.handler.state = states.SETMENU;
        this.emitWithState('ConfirmSetIntent');
    },
    'FourIntent': function () {
        var length = this.attributes['quizlet'].data.length;
        var index = this.attributes['quizlet'].index;
        if (length - index < 4) {
            this.handler.state = states.CONFIRMMULTIOPTION;
            this.emitWithState('Unhandled');
        }
        this.attributes['quizlet'].index += 3;
        this.handler.state = states.SETMENU;
        this.emitWithState('ConfirmSetIntent');
    },
    'AMAZON.NextIntent': function () {
        var length = this.attributes['quizlet'].data.length;
        var index = this.attributes['quizlet'].index;
        if (length - index > SETS_PER_PAGE) {
            this.attributes['quizlet'].index += SETS_PER_PAGE;
            this.handler.state = states.CONFIRMMULTIOPTION;
            this.emitWithState('ConfirmMultiOptionCommand');
        } else {
            this.handler.state = states.CONFIRMMULTIOPTION;
            this.emitWithState('Unhandled');
        }
    },
    'AMAZON.RepeatIntent': function () {
        this.handler.state = states.CONFIRMMULTIOPTION;
        this.emitWithState('ConfirmMultiOptionCommand');
    },
    'AMAZON.CancelIntent': function () {
        var speechOutput = this.t("STOP_MESSAGE");
        this.emit(':tell', speechOutput);
    },
    'AMAZON.StopIntent': function () {
        var speechOutput = this.t("STOP_MESSAGE");
        this.emit(':tell', speechOutput);
    },
    'AMAZON.StartOverIntent': function () {
        this.handler.state = states.MAINMENU;
        this.emitWithState('MainMenuCommand');
    },
    'AMAZON.HelpIntent': function () {
        var speechOutput = this.t("UNDEFINED");
        this.emit(':ask', speechOutput, speechOutput);
    },
    'Unhandled': function () {
        var speechOutput = this.t("NO_UNDERSTAND");
        var repromptSpeech = this.t("HELP_ME");
        this.emit(':ask', speechOutput, repromptSpeech);
    }
});

var setMenuHandlers = Alexa.CreateStateHandler(states.SETMENU, {
    'ConfirmSetIntent': function () {
        var set = this.attributes['quizlet'].data[this.attributes['quizlet'].index];
        this.attributes['quizlet'].set = set;
        this.attributes['quizlet'].data = undefined;
        this.attributes['quizlet'].index = undefined;
        this.emit(':tell', "You have chosen the set named " + set.title + ". It has " + set.terms.length + " terms in this set. ");
    }
});

function parseToken(access_token) {
    var token = {};
    token.user_id = access_token.split('|')[0];
    token.access_token = access_token.substring(access_token.indexOf('|') + 1);
    return token;
}

const languageStrings = {
    "en-US": {
        "translation": {
            "SKILL_NAME": "Quizlexa",
            "WELCOME_MESSAGE": "Welcome to %s. ",
            "HOW_CAN_I_HELP": "How can I help you? ",
            //"ASK_ME": "You can ask me to select a favorite set or to just select one of your sets. ",
            "ASK_ME": " ",
            "HELP_ME": "For instructions on what you can say, please say help me. ",
            "HELP_MESSAGE": "%s, or, you can say exit...Now, %s",
            "STOP_MESSAGE": "Goodbye! ",
            "NO_UNDERSTAND": "Sorry, I don't quite understand what you mean. ",
            "LINK_ACCOUNT": "Your Quizlet account is not linked.  Please use the Alexa app to link your account. ",
            "NO_FAVORITES": "You do not have any favorite sets yet. ",
            "NO_SETS": "You do not have any sets yet. Go to Quizlet dot com and add some sets to use.  Goodbye! ",
            "SET": "Set ",
            "ASK_USE_SET": "Do you want to use this set? ",
            "ASK_USE_SET_REPROMPT": "Say yes to use the set. Say no to return to the main menu. Say repeat to hear the set again. Or say help me for more options. ",
            "ASK_CHOOSE_SET": "Please choose from the following sets. ",
            "ASK_CHOOSE_SET_REPROMPTA": "Say the number of the set you want. Say repeat to hear the choices again. ",
            "ASK_CHOOSE_SET_REPROMPTB": "Or say help me to hear more options. ",
            "SAY_NEXT_MORE_SETS": "Say next for more sets. ",
            "OR_SAY_NEXT_MORE_SETS": "or say next for more sets. ",
            "SET_NAME_IS": "Your set name is %s. ",
            "UNDEFINED": "This text is undefined. ",
            "LINKED": "Your account is linked.  User ID %s.  Access Token <say-as interpret-as=\"characters\">%s</say-as>. "
        }
    }
};