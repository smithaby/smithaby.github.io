var isOnline = true;
/*
 * These variables should be defined by the developer
 *
 */
var HM_CLIENT_VERSION;
var HM_APP_URL;
var HM_APP_KEY;
var HM_APP_SECRET;
var HM_DEBUG_LOG_ENABLED;
var HM_TOKEN;
var HM_REFRESH_TOKEN;
var HM_TOKEN_EXPIRY;
var HM_APP_TIMEOUT;
var HM_LOG_THRESHOLD;
var HM_PROMISE_ENABLED = true;
var HM_REFRESH_ENABLED = true;
var HM_CLIENT_CONTEXT = "client-api";
var HM_DEVICE_UID;
var HM_REFRESH_CALLBACKS = [];

function alertMessage(text) {
    alert(text)
}
/*
 *  Function for custom logging functionalty
 */
function HM_Log(message)
{
    if(HM_DEBUG_LOG_ENABLED) {
        console.log(message);
    }
}


/*
 * Online and offline functions
 */
//var offlineQueueIndex = 0;
var lockedOnline=function(){

    if(isOnline) return;

    isOnline = true;
    HM_Log('We Are Online');

    setTimeout(function() {

        var objectsArray = JSON.parse(localStorage.getItem(('offline_objects')));
        var count = 0;
        var execCount = 0;
        var removeIndexes = [];


        var removeOfflineObjects = function(){
            for(var removeCount=0; removeCount < removeIndexes.length; removeCount++){
                objectsArray.splice(removeIndexes[removeCount], 1);
                for(var j = 0; j < removeIndexes.length ; j++){
                    if(removeIndexes[j] !== 0){
                        removeIndexes[j]--;
                    }
                }
            }
        };

        var markFailedOfflineObjects = function(){
            for(var k=0; k < objectsArray.length; k++){
                objectsArray[k].execfailed = true;
            }
        };

        var offlineDbCreateTransaction = function(objectType, data){
            var identifier = count++;
            objectType.create(data).then(
                function(success){
                    execCount++;
                    //console.log(identifier);
                    removeIndexes.push(identifier);
                    if(execCount === objectsArray.length) {

                        removeOfflineObjects();
                        markFailedOfflineObjects();

                        localStorage.removeItem("offline_objects");
                        localStorage.setItem("offline_objects", JSON.stringify(objectsArray));
                    }
                },
                function(error){
                    execCount++;
                    //console.log(identifier);
                    if(execCount === objectsArray.length) {

                        removeOfflineObjects();
                        markFailedOfflineObjects();

                        localStorage.removeItem("offline_objects");
                        localStorage.setItem("offline_objects", JSON.stringify(objectsArray));
                    }
                }
            );
        };

        var offlineDBUpdateTransaction = function(objectType, data){
            var identifier = count++;
            var object = new IClientObject(objectType, data);
            object.update(storedObject.data).then(
                function(success){
                    execCount++;
                    removeIndexes.push(identifier);
                    if(execCount === objectsArray.length) {

                        removeOfflineObjects();
                        markFailedOfflineObjects();

                        localStorage.removeItem("offline_objects");
                        localStorage.setItem("offline_objects", JSON.stringify(objectsArray));
                    }
                },
                function(error){
                    execCount++;
                    if(execCount === objectsArray.length) {

                        removeOfflineObjects();
                        markFailedOfflineObjects();

                        localStorage.removeItem("offline_objects");
                        localStorage.setItem("offline_objects", JSON.stringify(objectsArray));
                    }
                }
            );
        };

        var offlineDBDeleteTransaction = function(objectType, data){
            var identifier = count++;
            var object = new IClientObject(objectType, data);
            object.remove().then(
                function(success){
                    execCount++;
                    removeIndexes.push(identifier);
                    if(execCount === objectsArray.length) {

                        removeOfflineObjects();
                        markFailedOfflineObjects();

                        localStorage.removeItem("offline_objects");
                        localStorage.setItem("offline_objects", JSON.stringify(objectsArray));
                    }
                },
                function(error){
                    execCount++;
                    if(execCount === objectsArray.length) {

                        removeOfflineObjects();
                        markFailedOfflineObjects();

                        localStorage.removeItem("offline_objects");
                        localStorage.setItem("offline_objects", JSON.stringify(objectsArray));
                    }
                }
            );
        };

        if(objectsArray && objectsArray.length > 0) {

            for(var i=0; i < objectsArray.length; i++) {

                var storedObject = objectsArray[i];

                var tempclientObjectType = new IClientObjectType(storedObject.storeObjectName, storedObject.storeSchemaArray, storedObject.storeClientObject);

                if(storedObject.operation === tempclientObjectType.HMOperationType_CREATE) {
                    if(storedObject.execfailed !== true){
                        offlineDbCreateTransaction(tempclientObjectType, storedObject.data);
                    }else{
                        count++;
                    }
                }
                else if(storedObject.operation === tempclientObjectType.HMOperationType_UPDATE) {
                    if(storedObject.execfailed !== true){
                        offlineDBUpdateTransaction(tempclientObjectType,storedObject.data);
                    }else{
                        count++;
                    }
                }
                else if(storedObject.operation === tempclientObjectType.HMOperationType_DELETE) {
                    if(storedObject.execfailed !== true){
                        offlineDBDeleteTransaction(tempclientObjectType,storedObject.data);
                    }else{
                        count++;
                    }
                }
            }
        }
    }, 5000);
};

var onOffline=function(){
    if(!isOnline) return;

    isOnline = false;
    //console.log('We Are Offline');
};

var onOnline = function() {

    LockableStorage.lock("offline_objects", function ()
    {
        lockedOnline();
    }, 10000);
};

/*
 *   Register Event Listeners
 */
window.addEventListener("online", onOnline, false);
window.addEventListener("offline", onOffline, false);

var storeSession = function (isNative, session)
{
    HM_Log("session stored");
    if(!isNative){
        localStorage.removeItem(HM_APP_KEY + "_stored_session");
        localStorage.setItem(HM_APP_KEY + "_stored_session", JSON.stringify(session));
    }
    else{
        var tokenManager = TokenManager.getInstance();
        tokenManager.storedSession = JSON.stringify(session);
    }
};

var refreshLogin = function(callback){

    var callRefreshCallbacks = function(response){
        for(var cb in HM_REFRESH_CALLBACKS){
            HM_REFRESH_CALLBACKS[cb](response);
        }
        HM_REFRESH_CALLBACKS = [];
    };

    HM_Log("refresh token called");

    //push callback to refreshTokenCallbackspool
    HM_REFRESH_CALLBACKS.push(callback);
    if(HM_REFRESH_CALLBACKS.length > 1 ){
        return;
    }
    var url     = Constants.getUrl() + Constants.getTokenUrl();
    privateGetInstance(null,null,function(session){
        if(session instanceof ISession) {
            var token = session.privateGetAuthToken();
            if(!(token.code && token.message)){
                var tokenManager = TokenManager.getInstance();
                var refresh_token = tokenManager.refreshToken;
                if(refresh_token === null){
                    refresh_token = localStorage.getItem(HM_REFRESH_TOKEN);
                }

                var method  = "POST";
                var headers = {"Content-type":"application/x-www-form-urlencoded", "Accept":"application/json",
                    "Authorization":"Bearer " + token };
                var data = "grant_type=refresh_token&refresh_token=" + refresh_token + "&app_session=" + session.app_session + "&client_id=" + HM_DEVICE_UID;

                HM_HTTPRequest(url, method, headers, data, null, function(response){
                    if(response.status == 200)
                    {
                        var responseData = response.data;

                        var nativePlatforms = ['IOS','ANDROID','WINDOWS'];

                        if(nativePlatforms.indexOf(session.application.getOperatingSystem()) !== -1){
                            storeSession(true, session);
                            var tokenManager = TokenManager.getInstance();
                            tokenManager.accessToken = responseData.access_token;
                            tokenManager.refreshToken = responseData.refresh_token;
                            tokenManager.expiresIn = Math.floor(Date.now() / 1000) + responseData.expires_in;
                        }
                        else{
                            //WEB and MOBILE WEB app case
                            storeSession(false, session);
                            localStorage.setItem(HM_TOKEN, responseData.access_token);
                            localStorage.setItem(HM_REFRESH_TOKEN, responseData.refresh_token);
                            localStorage.setItem(HM_TOKEN_EXPIRY, Math.floor(Date.now() / 1000) + responseData.expires_in);
                        }

                        callRefreshCallbacks(responseData.access_token);
                    }
                    else{
                        callRefreshCallbacks(response.data);
                    }
                });
            }
            else{
                callRefreshCallbacks(token);
            }
        }
        else{
            callRefreshCallbacks(session);
        }
    });
};

function HM_HTTPRequest(url, method, headers, data, bypassCache, callback)
{
    var myRequest;
    var response = {};
    var error = EError.getInstance();

    if(window.XMLHttpRequest)
        myRequest = new XMLHttpRequest();
    //IE
    else if(window.ActiveXObject)
        myRequest = new ActiveXObject("Microsoft.XMLHTTP");
    
    myRequest.onload = function(){
        var responseHeaders = {};

        response.status = myRequest.status;
        if(myRequest.responseText === ""){
            response.data = "";
        }
        else if(myRequest.getResponseHeader('content-type') == 'application/json'){
            response.data = JSON.parse(myRequest.responseText);
        }
        else{
            response.data = myRequest.responseText;
        }

        //Build Response Header Object
        var splitHeaders = myRequest.getAllResponseHeaders().split("\n");

        if(splitHeaders.length > 0)
        {
            for(var i=0; i<splitHeaders.length; i++)
            {
                var splitValue = splitHeaders[i].split(": ");
                var key = splitValue[0].toLowerCase();
                var val = splitValue[1];

                if(key !== "" && key !== undefined)
                    responseHeaders[key] = val;
            }
        }

        response.headers = responseHeaders;

        if(myRequest.status == 200 || myRequest.status == 204)
        {
            callback(response);
        }
        else
        {
            if(myRequest.status == 401 && url.indexOf("token") == -1 && url.indexOf("revoke") == -1 && response.data.code == 12){
                if(HM_REFRESH_ENABLED){
                    refreshLogin(function(response1){
                        if(!(response1.code && response1.message)){
                            headers.Authorization = "Bearer " + response1;
                            HM_HTTPRequest(url,method,headers,data,bypassCache,callback);
                        }
                        else{
                            HM_Log(response);
                            localStorage.removeItem(HM_APP_KEY + "_stored_session");
                            localStorage.removeItem(HM_TOKEN);
                            localStorage.removeItem(HM_REFRESH_TOKEN);
                            localStorage.removeItem(HM_TOKEN_EXPIRY);

                            var tokenManager = TokenManager.getInstance();
                            tokenManager.accessToken = tokenManager.refreshToken = tokenManager.expiresIn = null;
                            callback(response);
                        }
                    });
                }
                else {
                    HM_Log(response);
                    callback(response);
                }
            }
            else if(myRequest.status == 404){
                response.data = error.getErrorObject(error.CONNECTION_FAILURE, []);
                HM_Log(response);
                callback(response);
            }
            else{
                callback(response);
            }
        }
    };

    myRequest.ontimeout = function(e){
        response.status = myRequest.status;
        response.headers = myRequest.getAllResponseHeaders().split("\n");
        response.data = error.getErrorObject(error.REQUEST_TIMEOUT, []);
        HM_Log(response);
        callback(response);
    };

    myRequest.onerror = function(e){
        response.status = myRequest.status;
        response.headers = myRequest.getAllResponseHeaders().split("\n");
        response.data = error.getErrorObject(error.UNKNOWN_ERROR, []);
        HM_Log(response);
        callback(response);
    };

    // Set URL
    myRequest.open(method, url, true);  // `false` makes the request synchronous

    //set TimeOut
    if(HM_APP_TIMEOUT !== undefined && HM_APP_TIMEOUT !== null && HM_APP_TIMEOUT !== 0){
        myRequest.timeout = HM_APP_TIMEOUT;
    }

    // Set Headers
    if(bypassCache)
        headers["Cache-Control"] = "no-cache";
    headers["If-Modified-Since"] = "Sat, 29 Oct 1994 19:43:31 GMT";

    for (var header in headers)
        myRequest.setRequestHeader(header,headers[header]);

    HM_Log("Request: " + url + "\n" +
        "Headers: " + JSON.stringify(headers) + "\n" +
        "data: " + data + "\n");

    if(data)
        myRequest.send(data);
    else
        myRequest.send();
};/**
 * Created by pradeep.kp on 15-11-2016.
 */
var LogLevel = {
    "TRACE": "TRACE" ,
    "DEBUG" : "DEBUG",
    "WARNING" : "WARNING",
    "FATAL" : "FATAL",
    "ERROR" : "ERROR"
};;/*
 *  Misc. Helper Functions Required For SDK
 */

/*
 *  Function to check if a string ends with a suffix
 */
String.prototype.endsWith = function(suffix) {

    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};
/*
 *  Function to check if a string begins with a prefix
 */
String.prototype.startsWith = function (prefix){
    return this.indexOf(prefix) === 0;
};
/*
 *  Function for case insensitive compare
 */
String.prototype.compareWith = function (string){
	return this.toUpperCase() === string.toUpperCase();
};;/*
 *  File to Store all Messages
 */
var EError = (function () {

        // Instance stores a reference to the Singleton
        var instance;

        function init() {

            return {

                    //Below are the enum, which are defined on the server
                    ACCESS_DENIED : 0,
                    NO_OBJECTS : 1,
                    NO_OBJECT : 2,
                    MISSING_INPUT : 3,
                    MISSING_REQUIRED_FIELD : 4,
                    QUERY_ERROR : 5,
                    OBJECT_EXISTS : 18,
                    SIGNATURE_CHECK_ERROR : 7,
                    USER_CREATE_ERROR : 8,
                    SAVE_ERROR : 9,
                    WRONG_FORMAT : 10,
                    APP_VERIFICATION_REQUIRED : 11,
                    INVALID_CLIENT : 12,
                    AUTHENTICATION_FAILURE : 13,
                    ADMIN_REQUIRED : 14,
                    INVALID_DEVICE : 15,
                    MISSING_SERVER : 16,
                    UNEXPECTED_OBJECT_COUNT : 17,
                    SERVICE_INVOCATION_ERROR : 6,
                    APP_DOWNLOAD_ERROR : 19,
                    MISSING_KEY_FIELD_ON_SERVICE : 20,
                    UNSUPPORTED_OPERATION : 21,
                    INVALID_INPUT : 22,
                    SERVICE_TEST_ERROR : 23,
                    UNEXPECTED_ERROR : 24,
                    APP_UNAVAILABLE : 25,
                    MISSING_CONFIGURATION : 26,
                    PIN_FAILURE : 27,
                    INVALID_AUTH_TOKEN : 28,
                    SEARCH_TERM_ERROR : 29,
                    GENERIC_ERROR_STRING : 30,
                    CHILD_REFERENCE_ERROR : 31,
                    USER_LOCKED : 32,
                    OBJECT_NOT_DELETEABLE : 33,
                    USER_DEVICE_REMOTE_WIPE_LOCKED : 34,
                    INVALID_FIELD_ON_SERVICE : 35,
                    INVALID_METADATA : 36,
                    REGISTERED_USER : 37,
                    INVALID_APP : 38,
                    INVALID_RELATIONSHIP : 39,
                    UPDATE_NOT_ALLOWED : 40,

                    //Below enum are not exist at server exception code.
                    MISSING_MANIFEST_ENTRIES : 41,
                    REQUEST_ERROR : 42,
                    MISSING_FIELD : 43,
                    INVALID_OBJECT_TYPE : 44,
                    DATA_FORMAT_ERROR : 45,
                    UNKNOWN_ERROR : 46,
                    NO_LISTENER_SPECIFIED : 47,
                    PARSE_ERROR : 48,
                    APP_VERIFICATION_FAILED : 49,
                    SESSION_INITIALIZATION_REQUIRED : 50,
                    TOKEN_EXPIRED : 51,
                    IDENTITY_OBJECT_NOT_DEFINED : 52,
                    KEY_ON_CREATE : 53,
                    KEY_GREATER_THAN_ZERO : 54,
                    NO_CONTENT : 55,
                    FILTER_STRING_MISMATCH : 56,
                    FILTER_STATEMENTS_ONLY : 57,
                    ADDED_TO_OFFLINE_QUEUE: 58,
                    NO_VALID_INPUT : 59,
                    REQUEST_TIMEOUT : 100,
                    CONNECTION_FAILURE: 404,

                    getErrorObject : function (errorCode, stringParams) {

                        var errorMessage;

                        switch(errorCode)
                        {

                            case 0  :   errorMessage =  "The server has denied access to resource";
                                        break;

                            case 1  :   errorMessage = "No Objects of type exist";
                                        break;

                            case 2  :   errorMessage = "No Objects of type exists";
                                        break;

                            case 3  :   errorMessage = "Field " + stringParams[0] + " is required for this request";
                                        break;

                            case 4  :   errorMessage = "field " + stringParams[0] + " is required on object " + stringParams[1];
                                        break;

                            case 5  :   errorMessage = "Query error on server";
                                        break;

                            case 18  :   errorMessage = "Object exists on server";
                                        break;

                            case 7  :   errorMessage = "The computed signature doesn't match input signature " + stringParams[0];
                                        break;

                            case 8  :   errorMessage = "The user cannot be created";
                                        break;

                            case 9  :   errorMessage = stringParams[0] + " could not be saved";
                                        break;

                            case 10 :   errorMessage = stringParams[0] + " is of the wrong format";
                                        break;

                            case 11 :   errorMessage = "App Verification failed. Please Retry";
                                        break;

                            case 12 :   errorMessage = "Unauthorised App";
                                        break;

                            case 13 :   errorMessage = "Username and password combination does not exist";
                                        break;

                            case 14 :   errorMessage = "Current user is not an admin";
                                        break;

                            case 15 :   errorMessage = "Invalid device";
                                        break;

                            case 16 :   errorMessage = "Configuration for " + stringParams[0] + " server is required";
                                        break;

                            case 17 :   errorMessage = "Found " + stringParams[0] + " objects of type " + stringParams[1];
                                        break;

                            case 6 :   errorMessage = "Error returned from calling " + stringParams[0] + " of type " + stringParams[1];
                                        break;

                            case 19 :   errorMessage = "Error in downloading app " + stringParams[0];
                                        break;

                            case 20 :   errorMessage = "Service " + stringParams[0] + " doesn't have a key configured";
                                        break;

                            case 21 :   errorMessage = "Operation not supported";
                                        break;

                            case 22 :   errorMessage = "Invalid Input " + stringParams[0] + " for field " + stringParams[1];
                                        break;

                            case 23 :   errorMessage = "Error " + stringParams[0] + " returned from calling " + stringParams[1] + " object " + stringParams[2];
                                        break;

                            case 24 :   errorMessage = "Error " + stringParams[0] + " returned";
                                        break;

                            case 25 :   errorMessage = stringParams[0] + " is not available";
                                        break;

                            case 26 :   errorMessage = "App " + stringParams[0] + " is missing configuration " + stringParams[1];
                                        break;

                            case 27 :   errorMessage = "User " + stringParams[0] + " pin doesn't match";
                                        break;

                            case 28 :   errorMessage = "Token " + stringParams[0] + " is invalid";
                                        break;

                            case 29 :   errorMessage = "You need at least " + stringParams[0] + " characters to search for " + stringParams[1];
                                        break;

                            case 30 :   errorMessage = stringParams[0];
                                        break;

                            case 31 :   errorMessage = "Child " + stringParams[0] + " has references to " +stringParams[1];
                                        break;

                            case 32 :   //errorMessage = "User " + stringParams[0] + " is locked";
                                        errorMessage = "User is locked";
                                        break;

                            case 33 :   errorMessage = "Object " + stringParams[0] + " with " + stringParams[1] + " is not deletable";
                                        break;

                            case 34 :   //errorMessage = "User/Device " + stringParams[0] + " is remote wiped";
                                        errorMessage = "User/Device is remote wiped";
                                        break;

                            case 35 :   errorMessage = "Service " + stringParams[0] + " doesn't have field '%s' configured";
                                        break;

                            case 36 :   errorMessage = "Expect field " + stringParams[0] + " to be " + stringParams[1] + ", found " +stringParams[2];
                                        break;

                            case 37 :   errorMessage = "User " + stringParams[0] + " has been sent a pin previously";
                                        break;

                            case 38 :   errorMessage = "App '%s' is not a/an " + stringParams[0] + " app";
                                        break;

                            case 39 :   errorMessage = "Object " + stringParams[0] + " is not related to " + stringParams[1];
                                        break;

                            case 40 :   errorMessage = "Field " + stringParams[0] + " for object " + stringParams[1] + " is non-updatable";
                                        break;

                            case 41 :   errorMessage = "The manifest has missing entries";
                                        break;

                            case 42 :   errorMessage = "The server returned an error";
                                        break;

                            case 43 :   errorMessage = "A mandatory field is missing";
                                        break;

                            case 44 :   errorMessage = "Client object type doesn't exist for app";
                                        break;

                            case 45 :   errorMessage = "Data format mismatch";
                                        break;

                            case 46 :   errorMessage = "The server has denied access to resource";
                                        break;

                            case 47 :   errorMessage = "No Listener is Specified.";
                                        break;

                            case 48 :   errorMessage = "Couldn't parse the response";
                                        break;

                            case 49 :   errorMessage = "App verification failed with message " + stringParams[0];
                                        break;

                            case 50:   errorMessage = "Session needs to be initialized before using it";
                                        break;

                            case 51 :   errorMessage = "Token has expired";
                                        break;

                            case 52 :   errorMessage = "Identity object undefined for current session.";
                                        break;

                            case 53 :   errorMessage = "Key field should not be passed on create call";
                                        break;

                            case 54 :   errorMessage = "Key " + stringParams[0] +" should be greater than 0";
                                        break;

                            case 55 :   errorMessage = "No Content";
                                        break;

                            case 56 :   errorMessage = "Invalid filter statement object";
                                        break;

                            case 57 :   errorMessage = "FilterStatements should contain only FilterStatement class object";
                                        break;

                            case 58 :   errorMessage = "You seem to be offline. Objects will be updated once connectivity is resumed";
                                        break;

                            case 59 :   errorMessage = "No valid Input provided to the method";
                                        break;

                            case 100:   errorMessage = "The request has timed out";
                                        break;

                            case 404:   errorMessage = "Could not connect to Server.";
                                        break;
                        }

                        return {code:errorCode, message:errorMessage};

                    }
            };

                
        }


        return {
            // Get the Singleton instance if one exists
            // or create one if it doesn't
            getInstance: function () {
                if ( !instance ) {

                    instance = init();
                }
                    return instance;
            }
        };

})();


;/**
 * Created by pradeep.kp on 10-06-2016.
 */

function ExceptionHandler(){
    var error = EError.getInstance();

    this.privateSubmitCrashLogs = function(logfile, callback){
        if(!(logfile instanceof File) && !(logfile instanceof Blob)){
            callback(error.getErrorObject(error.MISSING_INPUT, ["logfile"]));
        }
        else if(logfile.size === 0){
            callback(error.getErrorObject(error.INVALID_INPUT, ["logfile","size cannot be zero"]));
        }
        else{
            privateGetInstance(null, null, function(session){
                var token = session.privateGetAuthToken();
                if(!(token.code && token.message)){
                    var url = Constants.getUrl() + Constants.getCrashLogsUrl();
                    var method = "POST";
                    var headers = {"Authorization": "Bearer " + token};
                    var data = new FormData();

                    data.append("file",logfile);

                    HM_HTTPRequest(url,method,headers,data,true,function(response){
                        callback(response.data);
                    });
                }
                else {
                    callback(token);
                }
            });
        }
    };
}

ExceptionHandler.submitCrashLogs = function(logfile, callback){
    var exceptionHandler = new ExceptionHandler();
    if(HM_PROMISE_ENABLED){
        return new Promise(function(resolve,reject){
            exceptionHandler.privateSubmitCrashLogs(logfile, function(response){
                if(!(response.code && response.message)){
                    resolve(response);
                }
                else{
                    reject(response);
                }
            });
        });
    }
    else{
        exceptionHandler.privateSubmitCrashLogs(logfile, function(response){
            callback(response.data);
        });
    }
};;/**
 * Created by pradeep.kp on 03-05-2016.
 */
var EPollType = {
    "TRUE_FALSE": "TRUE_FALSE" ,
    "NUMERIC_RATING" : "NUMERIC_RATING",
    "SINGLE_CHOICE_TEXT" : "SINGLE_CHOICE_TEXT",
    "MULTI_CHOICE_TEXT" : "MULTI_CHOICE_TEXT",
    "SINGLE_CHOICE_IMAGE" : "SINGLE_CHOICE_IMAGE",
    "MULTI_CHOICE_IMAGE" : "MULTI_CHOICE_IMAGE",
    "WORD_CLOUD" : "WORD_CLOUD"
};

var HMBatchType = {
    "CREATE":0,
    "UPDATE":1,
    "DELETE":2,
    "UPSERT":3
};;function Constants()
{

}

Constants.getUrl = function() {

    var url = HM_APP_URL;

    if(!url) {

        HM_Log("Error! Global app url is not defined");
        return;
    }

    if(!url.endsWith("/"))
        url = url + "/";

    url =  url + HM_CLIENT_CONTEXT + "/api/";

    return url;
};

Constants.getVersionUrl = function() {

    return "version";
};

Constants.getUserRegistrationURL = function() {

    return "users";
};

Constants.getUserRegistrationPinURL = function() {

    return "register";
};

Constants.getUserUpdateURL = function() {

    return "users/update";
};
Constants.getAppUrl = function() {

    return "apps";
};
Constants.getAppUsersURL = function() {

    return "apps/" + HM_APP_KEY + "/users";
};
Constants.getAppDesignURL = function() {

    return "apps/" + HM_APP_KEY + "/design";
};
Constants.getServiceUrl = function() {

    return "services";
};

Constants.getSpecificServiceUrl = function(serviceName) {

    return "services/" + serviceName;
};

Constants.updateSpecificServiceUrl = function(serviceName,id) {

    return "services/" + serviceName +'/'+id;
};

Constants.getServiceMetadataUrl = function(serviceName) {

    return "services/" + serviceName + "?metadata=true";
};

Constants.getServiceUrlPaginated = function(serviceName, startIndex, size) {

    return "services/" + serviceName + "?start=" + startIndex + "&size=" + size;
};

Constants.getServiceUrlById = function(serviceName, objectId) {

    return "services/" + serviceName + "/" + objectId;
};

Constants.getRelatedServiceUrl = function(serviceName, objectId, relatedServiceName) {

    return "services/" + serviceName + "/" + objectId + "/" + relatedServiceName + "?";
};

Constants.getSearchServiceUrl = function(serviceName) {

    return "services/" + serviceName + "?";
};

Constants.getTokenUrl = function() {

    return "token/";
};

Constants.getLogoutUrl = function() {

    return "revoke/";
};

Constants.getCategoryUrl = function() {

    return "categories";
};

Constants.getCheckinUrl = function() {

    return "checkin";
};

Constants.getMediaUrl = function() {

    return "";
};

Constants.getPollUrl = function() {

    return "polls";
};

Constants.getPollResultsUrl = function(pollTitle) {

    return "polls/" + encodeURIComponent(pollTitle) + "/results";
};

Constants.getAnnouncementUrl = function() {

    return "psa";
};

Constants.getDeviceApplicationUrl = function() {

    return "devices/apps";
};
Constants.getServiceURL = function(serviceName) {

    return "code/" + serviceName;
};

Constants.getPollChoiceResponseURL = function(title){

    return Constants.getPollResultsUrl(title);
};

Constants.getPollResponsesUrl = function(pollTitle) {

    return "polls/" + encodeURIComponent(pollTitle) + "/responses";
};

Constants.getPollChoiceCreateUrl = function(pollTitle){

    return "polls/" + encodeURIComponent(pollTitle);
};

Constants.pollDeleteUrl = function(pollTitle){

    return "polls/" + encodeURIComponent(pollTitle);
};

Constants.pollUpdateUrl = function(pollTitle){

    return "polls/" + encodeURIComponent(pollTitle);
};

Constants.getPollChoiceDeleteUrl = function(pollTitle,choiceId){

    return "polls/" + encodeURIComponent(pollTitle) + "/choice/" + choiceId;
};

Constants.getBulkCreateUrl = function(clientObjectType){
    return "bulk/" + encodeURIComponent(clientObjectType);
};

Constants.getBulkUpdateUrl = function(clientObjectType){
    return "bulk/" + encodeURIComponent(clientObjectType)+"/update";
};
Constants.getBulkDeleteUrl = function(clientObjectType){
    return "bulk/" + encodeURIComponent(clientObjectType)+"/delete";
};

Constants.getBulkUpsertUrl = function(clientObjectType){
    return "bulk/" + encodeURIComponent(clientObjectType)+"/upsert";
};

Constants.getCrashLogsUrl = function(){
    return "devices";
};

Constants.getFunctionUrl = function(functionName){
    return "function/" + functionName;
};

Constants.getPasswordResetUrl = function(){
    return "users/reset_password";
};

Constants.getDeviceLogsUrl = function(){
    return "devicelog";
};

Constants.getEncryptionKeyUrl = function(){
    return "devices/key";
};

Constants.getAppCategoriesUrl = function(){
    return "categories";
};

Constants.getRevokeUrl = function(){
    return "revoke";
};

Constants.getWebSocketUrl = function(token){
    return "notifications?access_token=" + token;
};

Constants.getResendPinUrl = function(){
    return "register/resend/";
};

Constants.getUserRoleUrl = function(roleName){
    return "apps/roles/"+ roleName +"/users";
};

Constants.getUsersUrl = function(){
    return "apps/users";
};

Constants.getRolesUrl = function(){
    return "apps/roles";
};

Constants.licenseDateUrl = function(client_id){
    return "accounts/" + client_id + "/licensedate";
};

Constants.getCustomRevokeURL = function(){
    return "revoke/custom/reset_password";
};;/*  
 *  Object Class EEoperator
 */
var EOperator = (function () {

		var error = EError.getInstance();

		function init(filterString) {

			
			var operator = filterString;
			var alias = formatToString(filterString);

			this.ISNULL             = 0;//"null"; 
			this.NOT_NULL           = 1;//"notnull";
			this.EQUALS             = 2;//"eq";
			this.NOT_EQUALS         = 3;//"ne";
			this.GREATER_THAN       = 4;//"gt";
			this.GREATER_THAN_EQUAL = 5;//"ge";
			this.LESS_THAN          = 6;//"lt";
			this.LESS_THAN_EQUAL    = 7;//"le";

			function formatToString(format) {

				switch(format) {

					case this.ISNULL				:return "null";
					case this.NOT_NULL				:return "notnull";
					case this.EQUALS				:return "eq";
					case this.NOT_EQUALS			:return "ne";
					case this.GREATER_THAN			:return "gt";
					case this.GREATER_THAN_EQUAL	:return "ge";
					case this.LESS_THAN				:return "lt";
					case this.LESS_THAN_EQUAL		:return "le";
					default							:return null;
				}
			}

			this.getAlias = function() {

				return alias;
			};
			this.getOperator = function() {

				return operator;
			};
				
		}


		return {
			// Get the Singleton instance if one exists
			// or create one if it doesn't
			getOperatorObject: function (filterString) {

				if(!filterString)
					return null;

				if(filterString === this.ISNULL || filterString === this.NOT_NULL ||
					filterString === this.EQUALS || filterString === this.GREATER_THAN ||
					filterString === this.GREATER_THAN_EQUAL || filterString === this.LESS_THAN ||
					filterString === this.LESS_THAN_EQUAL) {

					var instance = init(filterString);

					return instance;
				} else {

					return null;
				}
			}
		};

})();;/*  
 *  Object Class For FieldMetadata
 */
function FieldMetadata(schemaDictionary)
{
	var name;
	var type;
	var required;
	var updateable;
	var key;
	var parent;

    // init prop
    this.prop = "";
    var self = this;

    // Public variables
    this.EValueType_OBJECT      = 0;
    this.EValueType_ENUM        = 1;
    this.EValueType_NUMERIC     = 2;
    this.EValueType_STRING      = 3;
    this.EValueType_DATE        = 4;
    this.EValueType_IP          = 5;
    this.EValueType_LAT_LONG    = 6;
    this.EValueType_NSFILE      = 7;
    this.EValueType_BOOLEAN     = 8;

	// Init Logic
	type = getValueType(schemaDictionary.data_type);
	name = schemaDictionary.name;
	updateable = schemaDictionary.updateable;
	required = schemaDictionary.required;
	parent = schemaDictionary.has_parent;

	if(schemaDictionary.key)
		key = true;
	// Init Logic

    function getValueType(dataType) {

		if (dataType == "OBJECT")
			return self.EValueType_OBJECT;

		else if (dataType == "ENUM")
			return self.EValueType_ENUM;

		else if (dataType == "NUMERIC")
			return self.EValueType_NUMERIC;

		else if (dataType == "STRING")
			return self.EValueType_STRING;

		else if (dataType == "DATE")
			return self.EValueType_DATE;

		else if (dataType == "IP")
			return self.EValueType_IP;

		else if (dataType == "LAT_LONG")
			return self.EValueType_LAT_LONG;

		else if (dataType == "FILE")
			return self.EValueType_NSFILE;

		else if (dataType == "BOOLEAN")
			return self.EValueType_BOOLEAN;

    }

    // Public Functions
    this.getName = function() {
		return name;
    };

    this.getType = function() {
		return type;
    };

    this.isRequired = function() {
		return required;
    };

    this.isUpdateable = function() {
		return updateable;
    };

    this.isKey = function() {
		return key;
    };

    this.hasParent = function() {
		return parent;
    };
};/*  
 *  Object Class For Filter Statement
 */
function FilterStatement(_field, _operator, _value) {


	var field = _field;
	var operator = _operator;
	var value = _value;

	this.getField = function () {

		return field;
	};
	this.getOperator = function () {

		return operator;
	};
	this.getValue = function () {

		return value;
	};
	this.validate = function () {

		if(!field)
			return false;

		if((operator === FilterStatement.ISNULL || operator === FilterStatement.NOT_NULL ||
			operator === FilterStatement.EQUALS || operator === FilterStatement.NOT_EQUALS ||
			operator === FilterStatement.GREATER_THAN || operator === FilterStatement.GREATER_THAN_EQUAL ||
			operator === FilterStatement.LESS_THAN || operator === FilterStatement.LESS_THAN_EQUAL ||
			operator === FilterStatement.LIKE  || operator === FilterStatement.IN))
			return true;

		return false;

	};
	this.getFilterStatement = function () {

		if(operator === FilterStatement.ISNULL || operator === FilterStatement.NOT_NULL) {

			return field + operator;
		}else {

			return field + " " + operator + " " + value;
		}
	};
}

FilterStatement.ISNULL				="null";
FilterStatement.NOT_NULL			="notnull";
FilterStatement.EQUALS				="eq";
FilterStatement.NOT_EQUALS			="ne";
FilterStatement.GREATER_THAN		="gt";
FilterStatement.GREATER_THAN_EQUAL	="ge";
FilterStatement.LESS_THAN			="lt";
FilterStatement.LESS_THAN_EQUAL		="le";
FilterStatement.LIKE				="like";
FilterStatement.IN					="in";;/**
 * Created by pradeep.kp on 07-04-2017.
 */
var HMNotification = function(openCB, closeCB, messageCB, errorCB){

    var webSocket;

    var error = EError.getInstance();

    var initWebSocket = function(){
        privateGetInstance(null,null,function(session){
            var token = session.privateGetAuthToken();
            if(!(token.code && token.message)){
                var loc = window.location;
                var baseUrl = Constants.getUrl().slice(Constants.getUrl().indexOf(":")).replace('api/','');
                var isSecure = (loc.protocol === "https:" || Constants.getUrl().substring(0, 5) === "https")?true:false;
                var protocol = "wss";
                if(baseUrl === "/"){
                    baseUrl = "://" + loc.host + "/";
                }
                if(!isSecure){
                    protocol = "ws";
                }

                var socketUrl = protocol + baseUrl + Constants.getWebSocketUrl(token);

                webSocket = new WebSocket(socketUrl);

                webSocket.onopen = function (evt) {
                    HM_Log("Web Socket opened");
                    openCB(evt);
                };

                webSocket.onclose = function (evt) {
                    HM_Log("Web Socket closed");
                    closeCB(evt);
                };

                webSocket.onmessage = function (evt) {
                    HM_Log("Web Socket data recieved");
                    messageCB(evt);
                };

                webSocket.onerror = function (evt) {
                    HM_Log("Web Socket error");
                    errorCB(evt);
                };
            }
            else{
                return token;
            }
        });
    };

    if(typeof openCB === "function" && typeof openCB === "function" && typeof openCB === "function" && typeof openCB === "function"){
        initWebSocket();
    }
    else{
        return error.getErrorObject(error.INVALID_INPUT,["parameters",""]);
    }

    this.close= function(){
        webSocket.close();
    };
};;/*  
 *  Object Class For Application
 */
/*
 *  Object Class For Application Using Function Prototyping
 */
function IApplication(dataDictionary)
{
    // init prop
    this.prop = "";
    var self = this;

    var error = EError.getInstance();

    this.name = null;
    this.modificationDate = null;
    this.applicationKey = null;
    this.description = null;
    this.hash = null;
    this.registrationMode = null;
    this.downloadUri = null;
    this.externalApp = null;
    this.rating = null;
    this.mediaLinks = null;
    this.lastVerificationDate = null;
    this.downloadDate = null;
    this.bundle_version = null;
    this.categories = null;
    this.log_level = null;

    this.passcodeRequired = null;
    this.allowRootedAccess = null;
    this.allow_save_credentials = null;
    this.isUpdatable = null;
    this.termsOfService = null;
    this.appPackageName = null;
    this.appSize = null;
    this.operating_system = null;

    this.titleColor = null;
    this.bodyHeaderColor = null;
    this.bodySubheaderColor = null;
    this.bodyColor = null;
    this.bodyTextColor = null;
    this.titleTextColor = null;
    this.menuColor = null;
    this.menuTextColor = null;

    if(dataDictionary.key)
        this.applicationKey = dataDictionary.key;
    else
        this.applicationKey = HM_APP_KEY;

    if(dataDictionary.modification_date)
        this.modificationDate = dataDictionary.modification_date;

    if(dataDictionary.bundle_version)
        this.bundle_version = dataDictionary.bundle_version;

    if(dataDictionary.bundle_identifier)
        this.bundle_identifier = dataDictionary.bundle_identifier;

    if(dataDictionary.key)
        this.applicationKey = dataDictionary.key;

    if(dataDictionary.name)
        this.name = dataDictionary.name;

    if(dataDictionary.description)
        this.description = dataDictionary.description;

    if(dataDictionary.hash)
        this.hash = dataDictionary.hash;

    if(dataDictionary.registration_mode)
        this.registrationMode = dataDictionary.registration_mode;

    if(dataDictionary.downloadUri)
        this.downloadUri = dataDictionary.downloadUri;

    if(dataDictionary.size)
        this.appSize = dataDictionary.size;

    if(dataDictionary.external)
        this.externalApp = dataDictionary.external;

    if(dataDictionary.categories)
        this.categories = dataDictionary.categories;

    if(dataDictionary.require_passcode)
        this.passcodeRequired = dataDictionary.require_passcode;

    if(dataDictionary.allow_rooted_device)
        this.allowRootedAccess = dataDictionary.allow_rooted_device;

    if(dataDictionary.allow_save_credentials)
        this.allow_save_credentials = dataDictionary.allow_save_credentials;

    if(dataDictionary.mediaLinks)
        this.mediaLinks = dataDictionary.mediaLinks;

    if(dataDictionary.terms_of_service)
        this.termsOfService = dataDictionary.terms_of_service;

    if(dataDictionary.lastVerificationDate)
        this.lastVerificationDate = dataDictionary.lastVerificationDate;

    if(dataDictionary.downloadDate)
        this.downloadDate = dataDictionary.downloadDate;

    if(dataDictionary.body_subheader_color)
        this.bodySubheaderColor = dataDictionary.body_subheader_color;
    else
        this.bodySubheaderColor = "#0F7BB4";

    if(dataDictionary.title_color)
        this.titleColor = dataDictionary.title_color;
    else
        this.titleColor = "#050505";

    if(dataDictionary.body_header_color)
        this.bodyHeaderColor = dataDictionary.body_header_color;
    else
        this.bodyHeaderColor = "#0F7B7cc0e6B4";

    if(dataDictionary.body_color)
        this.bodyColor = dataDictionary.body_color;
    else
        this.bodyColor = "#ffffff";

    if(dataDictionary.body_text_color)
        this.bodyTextColor = dataDictionary.body_text_color;
    else
        this.bodyTextColor = "#000000";

    if(dataDictionary.title_text_color)
        this.titleTextColor = dataDictionary.title_text_color;
    else
        this.titleTextColor = "#000000";

    if(dataDictionary.menu_color)
        this.menuColor = dataDictionary.menu_color;
    else
        this.menuColor = "#7cc0e6";

    if(dataDictionary.menu_text_color)
        this.menuTextColor = dataDictionary.menu_text_color;
    else
        this.menuTextColor = "#000000";

    if(dataDictionary.operating_system)
        this.operating_system = dataDictionary.operating_system;

    if(dataDictionary.updateable)
        this.isUpdatable = dataDictionary.updateable;

    if(dataDictionary.size)
        this.appSize = dataDictionary.size;

    if(dataDictionary.size)
        this.appSize = dataDictionary.size;

    if(dataDictionary.size)
        this.appSize = dataDictionary.size;

    if(dataDictionary.size)
        this.appSize = dataDictionary.size;

    if(dataDictionary.size)
        this.appSize = dataDictionary.size;

    if(dataDictionary.size)
        this.appSize = dataDictionary.size;

    if(dataDictionary.size)
        this.appSize = dataDictionary.size;

    if(dataDictionary.log_level)
        this.log_level = dataDictionary.log_level;



    this.getRating = function () {
        //HM_Log("get rating called");
        return self.rating;
    };

    this.getAppIcon = function (callback) {

        return new Promise(function(resolve, reject)
        {
            //HM_Log("get app icon called");
            var url = self.getIconUrl();

            HM_HTTPRequest(url, "GET", null, null,true,function(response){
                if(response.status === 200){
                    resolve(response.data);
                }
                else if(response.status === 204){
                    callback(error.getErrorObject(error.NO_CONTENT));
                }
                else{
                    reject(response.data);
                }
            });
        });
    };

    this.getMediaLinks = function () {
        return self.mediaLinks;
    };

    this.getName = function () {
        return self.name;
    };

    this.getModifiedDate = function () {
        return self.modificationDate;
    };

    this.getKey = function () {
        return self.applicationKey;
    };

    this.getDownloadUri = function () {
        return self.downloadUri;
    };

    this.getOperatingSystem = function () {
        return self.operating_system;
    };

    this.getIconUrl = function () {
        return Constants.getUrl() + Constants.getAppUrl() + "/" + self.getKey() + "?type=icon";
    };

    this.getRegistrationMode = function () {
        return self.registrationMode;
    };

    this.getDescription = function () {
        return self.description;
    };

    this.getHash = function () {
        return self.hash;
    };

    this.getCategories = function () {
        return self.categories;
    };

    this.getDownloadDate = function () {
        return self.downloadDate;
    };

    this.getLastVerificationDate = function () {
        return self.lastVerificationDate;
    };

    this.isPasscodeRequired = function () {
        return self.passcodeRequired;
    };

    this.isAllowRootedAccess = function () {
        return self.allowRootedAccess;
    };

    this.getTermsofService = function () {
        return self.termsOfService;
    };

    this.isAllowSaveCredential = function () {
        return self.allow_save_credentials;
    };

    this.getAppPackageName = function () {
        return self.appPackageName;
    };

    this.isExternalApp = function () {
        return self.externalApp;
    };

    this.isUpdatable = function () {
        return self.isUpdatable;
    };

    this.getAppSize = function () {
        return self.appSize;
    };

    this.getTitleColor = function () {
        return self.titleColor;
    };

    this.getTitleTextColor = function () {
        return self.titleTextColor;
    };

    this.getBodyHeaderColor = function () {
        return self.bodyHeaderColor;
    };

    this.getBodySubheaderColor = function () {
        return self.bodySubheaderColor;
    };

    this.getBodyColor = function () {
        return self.bodyColor;
    };

    this.getBodyTextColor = function () {
        return self.bodyTextColor;
    };

    this.getMenuColor = function () {
        return self.menuColor;
    };

    this.getMenuTextColor = function () {
        return self.menuTextColor;
    };

    this.getLogLevel = function(){
        return self.logLevel;
    };

    this.getBundleVersion = function(){
        return self.bundle_version;
    };
};function IClientObject(clientObjectType, clientObjectData) {

    // init prop
    this.prop = "";
    var self = this;

    this.id = null;
    this.data = null;
    this.type = null;

    if(clientObjectData.ETag)
        this.ETag = parseInt(clientObjectData.ETag.replace(/"/g, ''));

    var error = EError.getInstance();

    // Public Variables
    this.HMOperationType_CREATE = 0;
    this.HMOperationType_UPDATE = 1;
    this.HMOperationType_LIST   = 2;
    this.HMOperationType_DELETE = 3;

    // Init Logic
    this.type = clientObjectType;

    if(clientObjectData)
        this.data = clientObjectData;

    if (self.data && self.type && self.type.getKeyField() && self.data[self.type.getKeyField()])
        this.id = self.data[self.type.getKeyField()];

    this.requiredfields = self.type.privateGetRequiredFieldNames();
    this.file_fields = self.type.privateGetFileFieldNames();
    // Init Logic

    // Private Functions
    function privateValidate(params, operationType) {
        var response = null;
        switch(operationType) {

            case self.HMOperationType_UPDATE :	// Check if all required fields are passed
                for(var requiredCountUpdate = 0; requiredCountUpdate < params.length; requiredCountUpdate++) {

                    var fieldNameUpdate = self.type.requiredFields[params[requiredCountUpdate]];
                    var requiredMetadataUpdate = self.type.schemaMap[fieldNameUpdate];

                    //validation for field whether they are updateable or not
                    if(!requiredMetadataUpdate.isUpdateable()) {
                        response = error.getErrorObject(error.UPDATE_NOT_ALLOWED, [fieldNameUpdate, self.type.name]);
                    }
                }
                // Resolve if validated Succesfully
                if(response === null){
                    response = true;
                }
                break;

            case self.HMOperationType_LIST : break;

            case self.HMOperationType_DELETE : break;

            default : break;
        }
        return response;
    }

    function genericUpdate(url, object, session, callback) {

        if(self.type.enableOfflineWrite === true)
        {
            if (isOnline) {
                //online previous functionality will work
            } else {
                //if enableofflinewrite set and internet is of then we need to store object in local storage
                var objArray = [];

                if(localStorage.getItem('offline_objects'))
                {
                    objArray = JSON.parse(localStorage.getItem(('offline_objects')));
                }
                //set data to localstorage
                var obj = {};
                //obj.id = offlineQueueIndex++;
                obj.storeObjectName = self.type.storeObjectName;
                obj.storeSchemaArray = self.type.storeSchemaArray;
                obj.storeClientObject = self.type.storeClientObject;
                obj.data = object;
                obj.data[self.type.getKeyField()] = self.id;
                obj.operation = self.HMOperationType_UPDATE;
                obj.execfailed = false;
                objArray.push(obj);

                localStorage.removeItem("offline_objects");
                localStorage.setItem("offline_objects", JSON.stringify(objArray));

                callback(error.getErrorObject(error.ADDED_TO_OFFLINE_QUEUE));
            }
        }

        var token = session.privateGetAuthToken();
        if(!(token.code && token.message)){

            var method  = "POST";
            var headers = {};
            var data    = "";
            var toSend  = "";

            var formData = new FormData();
            var paramsAdded = false;
            for(var key in object){
                if(key === "ETag"){
                    //do nothing
                }
                else{
                    if(self.type.fileFields.length > 0){

                        if(object[key] !== null && typeof object[key] === 'object' && self.type.fileFields.indexOf(object[key]) !== -1)
                            formData.append(key, JSON.stringify(object[key]));
                        else
                            formData.append(key, object[key]);
                    }
                    else{
                        if(!paramsAdded){
                            if(object[key] !== null && typeof object[key] === 'object')
                            {
                                if(JSON.stringify(object[key]).indexOf("&") == -1)
                                    data = key + "=" + JSON.stringify(object[key]);
                                else
                                    data = key + "=" + JSON.stringify(object[key]).replace(/&/g,'%26');
                            }
                            else
                            {
                                data = key + "=" + encodeURIComponent(object[key]);
                            }
                            paramsAdded = true;
                        }else{
                            if(object[key] !== null && typeof object[key] === 'object')
                            {
                                if(JSON.stringify(object[key]).indexOf("&") == -1)
                                    data = data + "&" + key + "=" + JSON.stringify(object[key]);
                                else
                                    data = data + "&" + key + "=" + JSON.stringify(object[key]).replace(/&/g,'%26');
                            }
                            else
                            {
                                data = data + "&" + key + "=" + encodeURIComponent(object[key]);
                            }
                        }
                    }
                }
            }

            if(data.length > 0) {

                if(self.type.enableOptimisticLocking === true){
                    if(self.ETag === undefined || self.ETag === null || self.ETag === "")
                    {
                        headers = {"Content-type":"application/x-www-form-urlencoded", "Accept":"application/json", "Authorization":"Bearer " + token};
                    }
                    else
                    {
                        headers = {"Content-type":"application/x-www-form-urlencoded", "Accept":"application/json", "Authorization":"Bearer " + token, "If-Match":self.ETag};
                    }
                }
                else{
                    headers = {"Content-type":"application/x-www-form-urlencoded", "Accept":"application/json", "Authorization":"Bearer " + token};
                }

                toSend = data;
            }else {

                if(self.type.enableOptimisticLocking === true){
                    if(self.ETag === undefined || self.ETag === null || self.ETag === "")
                    {
                        headers = {"Accept":"application/json", "Authorization":"Bearer " + token};
                    }
                    else
                    {
                        headers = {"Accept":"application/json", "Authorization":"Bearer " + token,"If-Match":self.ETag};
                    }
                }
                else{
                    headers = {"Accept":"application/json", "Authorization":"Bearer " + token};
                }
                toSend = formData;
            }

            HM_HTTPRequest(url, method, headers, toSend, null, function(response){
                if(response.status === 200 || response.status === 204) {
                    callback(response.data);
                }
                else {
                    if(response.status === 412)
                    {
                        var response1 = self.type.get(self.id,true);
                        if(response1 instanceof IClientObject) {
                            callback([object,response1.data]);
                        }
                        else{
                            callback(response.data);
                        }
                    }
                    else
                    {
                        callback(response.data);
                    }
                }
            });
        }
        else{
            callback(token);
        }
    }
    function genericDelete(url, session, callback) {
        if(self.type.enableOfflineWrite === true)
        {
            if (isOnline) {
                //online previous functionality will work
            } else {
                //if enableofflinewrite set and internet is of then we need to store object in local storage
                var objArray = [];

                if(localStorage.getItem('offline_objects'))
                {
                    objArray = JSON.parse(localStorage.getItem(('offline_objects')));
                }
                //set data to localstorage
                var obj = {};
                //obj.id = offlineQueueIndex++;
                obj.storeObjectName = self.type.storeObjectName;
                obj.storeSchemaArray = self.type.storeSchemaArray;
                obj.storeClientObject = self.type.storeClientObject;
                obj.data = self.data;
                obj.data[self.type.getKeyField()] = self.id;
                obj.operation = self.HMOperationType_DELETE;
                obj.execfailed = false;
                objArray.push(obj);

                localStorage.removeItem("offline_objects");
                localStorage.setItem("offline_objects", JSON.stringify(objArray));

                callback(error.getErrorObject(error.ADDED_TO_OFFLINE_QUEUE));
            }
        }

        var token = session.privateGetAuthToken();
        if(!(token.code && token.message)){
            var method  = "DELETE";
            var headers = {"Accept":"application/json", "Authorization":"Bearer " + token};

            HM_HTTPRequest(url, method, headers, null, null, function(response){
                callback(response);
            });
        }
        else {
            callback(token);
        }
    }

    function checkConditions(callback) {

        // Check Verify
        privateGetInstance(null,null,function(session){
            if(session instanceof ISession) {

                var tokenResponse = session.privateGetAuthToken();
                if(!(tokenResponse.data && tokenResponse.data.code)){
                    callback(session);
                }
                else{
                    callback(tokenResponse);
                }
            }
            else{
                callback(session);
            }
        });
    }

    function privateUpdate(clientObjectName, object, session, callback) {
        var url     = Constants.getUrl() + Constants.updateSpecificServiceUrl(clientObjectName, self.id);
        genericUpdate(url, object, session, function(response){
            callback(response);
        });
    }

    function privateDelete(clientObjectName, id, session, callback) {
        var url     = Constants.getUrl() + Constants.updateSpecificServiceUrl(clientObjectName,id);
        genericDelete(url,session, function(response){
            callback(response);
        });
    }
    // Private Functions

    // Public Functions
    this.getId = function() {

        return self.id;
    };
    this.getType = function() {

        return self.type;
    };
    this.getData = function() {

        return self.data;
    };
    this.getEtag = function() {

        return self.Etag;
    };
    this.update = function(object, callback) {
        HM_Log("ClientObject update called.");
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject) {
                checkConditions(function(session){
                    if(session instanceof ISession) {
                        if(!object)
                            reject(error.getErrorObject(error.MISSING_INPUT, ["Object"]));
                        else if(!self.type.getName())
                            reject(error.getErrorObject(error.MISSING_INPUT, ["Name"]));
                        else if(!self.id)
                            reject(error.getErrorObject(error.MISSING_INPUT, ["id"]));
                        else{
                            var isValid = privateValidate(object, self.HMOperationType_UPDATE);
                            if(isValid === true) {
                                privateUpdate(self.type.getName(), object, session, function(response){
                                    if(!(response.code && response.message)) {
                                        resolve(response);
                                    }
                                    else{
                                        HM_Log(response);
                                        reject(response);
                                    }
                                });
                            }
                            else{
                                reject(isValid);
                            }
                        }
                    }
                    else{
                        reject(session);
                    }
                });
            });
        }
        else{
            checkConditions(function(session){
                if(session instanceof ISession) {
                    if(!object)
                        callback(error.getErrorObject(error.MISSING_INPUT, ["Object"]));
                    else if(!self.type.getName())
                        callback(error.getErrorObject(error.MISSING_INPUT, ["Name"]));
                    else if(!self.id)
                        callback(error.getErrorObject(error.MISSING_INPUT, ["id"]));
                    else{
                        var isValid = privateValidate(object, self.HMOperationType_UPDATE);
                        if(isValid === true) {
                            privateUpdate(self.type.getName(), object, session, function(response){
                                HM_Log(response);
                                callback(response);
                            });
                        }
                        else{
                            callback(isValid);
                        }
                    }
                }
                else{
                    callback(session);
                }
            });
        }
    };

    this.remove = function(callback) {
        HM_Log("ClientObject delete called.");
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject) {
                if(!self.type.getName()){
                    reject(error.getErrorObject(error.MISSING_INPUT, ["Name"]));
                }
                else if(!self.id){
                    reject(error.getErrorObject(error.MISSING_INPUT, ["id"]));
                }
                else{
                    checkConditions(function(session){
                        if(session instanceof ISession) {
                            privateDelete(self.type.getName(), self.id, session, function(response){
                                if(response.data === "") {
                                    resolve(true);
                                }
                                else {
                                    reject(response.data);
                                }
                            });
                        }
                        else{
                            reject(session);
                        }
                    });
                }
            });
        }
        else{
            if(!self.type.getName()){
                callback(error.getErrorObject(error.MISSING_INPUT, ["Name"]));
            }
            else if(!self.id){
                callback(error.getErrorObject(error.MISSING_INPUT, ["id"]));
            }
            else{
                checkConditions(function(session){
                    if(session instanceof ISession) {
                        privateDelete(self.type.getName(), self.id, session, function(response){
                            if(response.data === "") {
                                callback(true);
                            }
                            else {
                                HM_Log(response.data);
                                callback(response.data);
                            }
                        });
                    }
                    else{
                        callback(session);
                    }
                });
            }
        }
    };
};/*  
 *  Object Class For IClientObjectType
 */
function IClientObjectType(objectName, schemaArray, clientObject)
{
    // init prop
    this.prop = "";
    var self = this;

    this.name = objectName;
    this.keyField = null;
    this.schema = [];
    this.requiredFields = [];
    this.fileFields = [];
    this.isIdentityObject = null;

    this.enable_create = clientObject && clientObject.enable_create ? clientObject.enable_create : false;
    this.enable_update = clientObject && clientObject.enable_update ? clientObject.enable_update : false;
    this.enable_delete = clientObject && clientObject.enable_delete ? clientObject.enable_delete : false;
    this.enable_offline_write = clientObject && clientObject.enable_offline_write ? clientObject.enable_offline_write : false;
    this.enable_optimistic_locking = clientObject && clientObject.enable_optimistic_locking ? clientObject.enable_optimistic_locking : false;

    this.schemaMap = {};

    this.storeObjectName = objectName;
    this.storeSchemaArray = schemaArray;
    this.storeClientObject = clientObject;

    var error = EError.getInstance();

    this.HMOperationType_CREATE = 0;
    this.HMOperationType_UPDATE = 1;
    this.HMOperationType_LIST   = 2;
    this.HMOperationType_DELETE = 3;

    // Init Logic
    for(var schemaArrayCount=0; schemaArrayCount < schemaArray.length; schemaArrayCount++) {

        var schemaDictionary = schemaArray[schemaArrayCount];
        var metaData1 = new FieldMetadata(schemaDictionary);

        this.schemaMap[schemaDictionary.name] = metaData1;
        this.schema.push(metaData1);
    }
    for(var schemaCount=0; schemaCount < self.schema.length; schemaCount++) {

        var metaData2 = self.schema[schemaCount];

        if(metaData2.isRequired() && !metaData2.isKey())
            self.requiredFields.push(metaData2.getName());

        if(metaData2.isKey())
            self.keyField = metaData2.getName();

        if(metaData2.getType() == metaData2.EValueType_NSFILE)
            self.fileFields.push(metaData2.getName());
    }
    // Init Logic

    // Private Functions
    function privateValidate(params, operationType) {
        var response = true;
        switch(operationType) {

            case self.HMOperationType_CREATE :	// Check if all required fields are passed
                for(var requiredCountCreate = 0; requiredCountCreate < self.requiredFields.length; requiredCountCreate++) {

                    var fieldNameCreate = self.requiredFields[requiredCountCreate];
                    var requiredMetadataCreate = self.schemaMap[fieldNameCreate];

                    if(!(params[fieldNameCreate] || params[fieldNameCreate] === false || params[fieldNameCreate] === 0) && !requiredMetadataCreate.hasParent() && !requiredMetadataCreate.isKey()) {
                        response = error.getErrorObject(error.MISSING_REQUIRED_FIELD, [fieldNameCreate, this.name]);
                    }
                    if(requiredMetadataCreate.isKey()) {
                        response = error.getErrorObject(error.KEY_ON_CREATE);
                    }
                    if(requiredMetadataCreate.hasParent() && params.fieldNameCreate && requiredMetadataCreate.getType() == requiredMetadataCreate.EValueType_NUMERIC) {
                        if(params.fieldNameCreate < 1) {
                            response = error.getErrorObject(error.KEY_GREATER_THAN_ZERO);
                        }
                    }
                }
                break;

            case self.HMOperationType_UPDATE :	// Check if all required fields are passed
                for(var requiredCountUpdate = 0; requiredCountUpdate < self.requiredFields.length; requiredCountUpdate++) {

                    var fieldNameUpdate = self.requiredFields[requiredCountUpdate];
                    var requiredMetadataUpdate = self.schemaMap[fieldNameUpdate];

                    if(!params[fieldNameUpdate] && !requiredMetadataUpdate.hasParent() && !requiredMetadataUpdate.isKey()) {

                        response = error.getErrorObject(error.MISSING_INPUT, [fieldNameUpdate]);
                    }
                    if(!requiredMetadataUpdate.isUpdateable()) {

                        response = error.getErrorObject(error.UPDATE_NOT_ALLOWED, [fieldNameUpdate, self.name]);
                    }
                }
                break;

            case self.HMOperationType_LIST : break;

            case self.HMOperationType_DELETE : break;

            default :	response = error.getErrorObject(error.UNSUPPORTED_OPERATION);
                break;
        }
        return response;
    }
    function genericCreate(url, object, session, callback) {
        if(self.enableOfflineWrite === true)
        {
            if (isOnline) {
                //online previous functionality will work
            }
            else {
                var objArray = [];

                if(localStorage.getItem('offline_objects'))
                {
                    objArray = JSON.parse(localStorage.getItem(('offline_objects')));
                }
                //set data to localstorage
                var obj = {};
                //obj.id = offlineQueueIndex++;
                obj.storeObjectName = self.storeObjectName;
                obj.storeSchemaArray = self.storeSchemaArray;
                obj.storeClientObject = self.storeClientObject;
                obj.data = object;
                obj.operation = self.HMOperationType_CREATE;
                obj.execfailed = false;
                objArray.push(obj);

                localStorage.removeItem("offline_objects");
                localStorage.setItem("offline_objects", JSON.stringify(objArray));

                callback(error.getErrorObject(error.ADDED_TO_OFFLINE_QUEUE));
                return;
            }
        }

        var token = session.privateGetAuthToken();
        if(!(token.code && token.message)){

            var method  = "POST";
            var headers = {};
            var data    = "";
            var toSend  = "";

            var formData = new FormData();

            var hasObject = false;
            var hasFile = false;
            // Check if object has nested object field
            for(var objectKey in object) {

                if(self.fileFields.indexOf(objectKey) !== -1){
                    hasFile = true;
                }

                if(object[objectKey] !== null && typeof object[objectKey] === 'object') {
                    hasObject = true;
                    break;
                }
            }

            // Build data
            if(hasObject && !(hasFile)) {
                headers = {"Content-type":"application/json", "Accept":"application/json", "Authorization":"Bearer " + token};
                toSend = JSON.stringify(object).replace(/&/g,'%26');
            }
            else {
                for(var key in object) {
                    if(self.fileFields.length > 0)
                        formData.append(key, object[key]);
                    else
                        data = data + "&" + key + "=" + encodeURIComponent(object[key]);
                }

                if(data.length > 0) {
                    headers = {"Content-type":"application/x-www-form-urlencoded", "Accept":"application/json", "Authorization":"Bearer " + token};
                    toSend = data;

                } else {
                    headers = {"Accept":"application/json", "Authorization":"Bearer " + token};
                    toSend = formData;
                }
            }

            HM_HTTPRequest(url, method, headers, toSend, null, function(response){
                callback(response.data);
            });
        }
        else{
            callback(token);
        }
    }

    function privateCreate(object, session, callback) {
        var url     = Constants.getUrl() + Constants.getSpecificServiceUrl(self.name);
        genericCreate(url, object, session, function(response){
            callback(response);
        });
    }

    function privateCreateRelated(objectID, relationName, relatedObject, session, callback) {
        var url     = Constants.getUrl() + Constants.getRelatedServiceUrl(self.name, objectID, relationName);
        genericCreate(url, relatedObject, session, function(response){
            callback(response);
        });
    }

    function checkConditions(checkSchema, callback) {

        // Check Verify
        privateGetInstance(null,null,function(session){
            if(session instanceof ISession) {
                var token = session.privateGetAuthToken();
                if(!(token.data && token.data.code)) {

                    if(checkSchema) {

                        if(!self.schema) {

                            var schema = privateGetSchema();
                            if(!(schema.code && schema.message)) {
                                callback(session);
                            }
                            else{
                                callback(schema);
                            }
                        }
                        else {
                            callback(session);
                        }
                    }
                    else {
                        callback(session);
                    }
                }
                else{
                    callback(token);
                }
            }
            else{
                callback(session);
            }
        });
    }
    // Private Functions

    // Public Functions
    this.validateInputs = function(params, operationType) {
        if(!self.schema) {
            var schema = privateGetSchema();
            if(!(schema.code && schema.message)) {
                return privateValidate(params, operationType);
            }
            else{
                return schema;
            }
        }else {
            return privateValidate(params, operationType);

        }
    };

    this.getName = function() {

        return self.name;
    };

    this.getKeyField = function() {

        return self.keyField;
    };

    var privateGetSchema = function(callback){
        if(!self.name){
            callback(error.getErrorObject(error.MISSING_INPUT, ["Object Name"]));
        }
        else if(self.schema){
            callback(self.schema);
        }
        else{
            checkConditions(false, function(session){
                if(session instanceof ISession){
                    var token = session.privateGetAuthToken();
                    if(!(token.data && token.data.code)){

                        var url     = Constants.getUrl() + Constants.getServiceMetadataUrl(self.name);
                        var method  = "GET";
                        var headers = {"Content-type":"application/x-www-form-urlencoded", "Accept":"application/json", "Authorization":"Bearer " + token};

                        HM_HTTPRequest(url, method, headers,null,true,function(response){
                            if(response.status === 200 || response.status === 204) {

                                var array = response.data;

                                if(schemaArray.length > 0) {

                                    self.schema = [];
                                    self.requiredFields = [];
                                    self.fileFields = [];
                                    self.schemaMap = {};

                                    for(var schemaArrayCount=0; schemaArrayCount < array.length; schemaArrayCount++) {

                                        var schemaDictionary = array[schemaArrayCount];
                                        var metaData1 = new FieldMetadata(schemaDictionary);

                                        self.schemaMap[schemaDictionary.name] = metaData1;
                                        self.schema.push(metaData1);
                                    }
                                    for(var schemaCount=0; schemaCount < self.schema.length; schemaCount++) {

                                        var metaData2 = self.schema[schemaCount];

                                        if(metaData2.isRequired() && !metaData2.isKey())
                                            self.requiredFields.push(metaData2.getName());

                                        if(metaData2.isKey())
                                            self.keyField = metaData2.getName();

                                        if(metaData2.getType() == metaData2.EValueType_NSFILE)
                                            self.fileFields.push(metaData2.getName());
                                    }

                                    callback(self.schema);
                                }
                                else {
                                    callback(error.getErrorObject(error.UNKNOWN_ERROR));
                                }
                            }
                            else{
                                callback(response.data);
                            }
                        });
                    }
                    else{
                        callback(token);
                    }
                }
                else{
                    callback(session);
                }
            });
        }
    };

    this.getSchema = function(callback) {
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateGetSchema(function(schema){
                    if(!(schema.code && schema.message)){
                        resolve(schema);
                    }
                    else{
                        reject(schema);
                    }
                });
            });
        }
        else{
            privateGetSchema(function(schema){
                callback(schema);
            });
        }
    };

    this.create = function(object, callback) {
        HM_Log("ClientObjectType create called.");
        if(HM_PROMISE_ENABLED) {
            return new Promise(function (resolve, reject) {
                checkConditions(true, function(session){
                    if (session instanceof ISession) {
                        if(!object){
                            reject(error.getErrorObject(error.MISSING_INPUT, ["Object"]));
                        }
                        else if(!self.name){
                            reject(error.getErrorObject(error.MISSING_INPUT, ["Name"]));
                        }
                        else{
                            var isValid = self.validateInputs(object, self.HMOperationType_CREATE);
                            if(isValid === true){
                                privateCreate(object, session, function(response){
                                    if(!(response.code && response.message)) {
                                        var clientObject = new IClientObject(self, response);
                                        resolve(clientObject);
                                    }
                                    else{
                                        HM_Log(response);
                                        reject(response);
                                    }
                                });
                            }
                            else{
                                reject(isValid);
                            }
                        }
                    }
                    else {
                        reject(session);
                    }
                });
            });
        }
        else{
            checkConditions(true, function(session){
                if (session instanceof ISession) {
                    if(!object){
                        callback(error.getErrorObject(error.MISSING_INPUT, ["Object"]));
                    }
                    else if(!self.name){
                        callback(error.getErrorObject(error.MISSING_INPUT, ["Name"]));
                    }
                    else{
                        var isValid = self.validateInputs(object, self.HMOperationType_CREATE);
                        if(isValid === true){
                            privateCreate(object, session, function(response){
                                if(!(response.code && response.message)) {
                                    var clientObject = new IClientObject(self, response);
                                    callback(clientObject);
                                }else{
                                    HM_Log(response);
                                    callback(error.getErrorObject(response.code, [response.message]));
                                }
                            });
                        }
                        else{
                            callback(isValid);
                        }
                    }
                }
                else {
                    callback(session);
                }
            });
        }
    };

    this.addRelated = function(objectID, relationName, relatedObject, callback) {
        HM_Log("ClientObjectType create related called.");
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject) {
                checkConditions(true, function(session){
                    if (session instanceof ISession) {

                        if(!objectID)
                            callback(error.getErrorObject(error.MISSING_INPUT, ["Object ID"]));
                        else if(!relatedObject)
                            callback(error.getErrorObject(error.MISSING_INPUT, ["Related Object"]));
                        else if(!relationName)
                            callback(error.getErrorObject(error.MISSING_INPUT, ["Relation Name"]));
                        else{
                            session.privateGetClientObjectType(relationName, function(clientObjectType){
                                if(clientObjectType instanceof IClientObjectType) {
                                    privateCreateRelated(objectID, relationName, relatedObject, session,function(response){
                                        if(!(response.code && response.message)) {
                                            var clientObject = new IClientObject(self, response);
                                            resolve(clientObject);
                                        }else{
                                            reject(response);
                                        }
                                    });
                                }
                                else{
                                    reject(error.getErrorObject(error.INVALID_OBJECT_TYPE,[relationName]));
                                }
                            });
                        }
                    }
                    else {
                        reject(session);
                    }
                });
            });
        }
        else{
            checkConditions(true, function(session){
                if (session instanceof ISession) {
                    if(!objectID)
                        callback(error.getErrorObject(error.MISSING_INPUT, ["Object ID"]));
                    else if(!relatedObject)
                        callback(error.getErrorObject(error.MISSING_INPUT, ["Related Object"]));
                    else if(!relationName)
                        callback(error.getErrorObject(error.MISSING_INPUT, ["Relation Name"]));
                    else{
                        session.privateGetClientObjectType(relationName, function(clientObjectType){
                            if(clientObjectType instanceof IClientObjectType) {
                                var isValid = clientObjectType.validateInputs(relatedObject, self.HMOperationType_CREATE);
                                if(isValid === true){
                                    privateCreateRelated(objectID, relationName, relatedObject, session,function(response){
                                        if(!(response.code && response.message)) {
                                            var clientObject = new IClientObject(self, response);
                                            callback(clientObject);
                                        }else{
                                            callback(response);
                                        }
                                    });
                                }
                                else{
                                    callback(isValid);
                                }
                            }
                            else{
                                callback(error.getErrorObject(error.INVALID_OBJECT_TYPE,[relationName]));
                            }
                        });
                    }
                }
                else {
                    callback(session);
                }
            });
        }
    };

    var privateList = function(startIndex, size, fields, bypassCache, callback){
        HM_Log("ClientObjectType list called.");
        var i =0;
        checkConditions(true, function(session){
            if(session instanceof ISession) {

                if(!startIndex)
                    startIndex = 0;
                if(!size)
                    size = 50;

                var token = session.privateGetAuthToken();
                if(!(token.data && token.data.code)){
                    var method  = "GET";
                    var url     = Constants.getUrl() + Constants.getServiceUrlPaginated(self.name, startIndex, size);
                    var headers = {"Accept":"application/json", "Authorization":"Bearer " + token};

                    if(fields && fields.length > 0) {
                        for(i=0; i < fields.length; i++) {
                            url = url + "&fields=" + fields[i];
                        }
                    }

                    HM_HTTPRequest(url, method, headers, null, bypassCache, function(response){
                        if(response.status === 200 || response.status === 204) {
                            var array = [];
                            var data  = response.data;

                            if(response && data.length > 0) {
                                for(i=0; i < data.length; i++) {
                                    var object = data[i];
                                    var clientObject = new IClientObject(self, object);
                                    array.push(clientObject);
                                }

                                callback(array);
                            }
                            else {
                                callback(error.getErrorObject(error.NO_CONTENT));
                            }
                        }
                        else{
                            HM_Log(response.data);
                            if(response.data.code === 18){
                                var  errorResponse = {"code":18,"message":"Unable to connect to the Datasource, Please Check the Datasource Configuration or contact the Administrator."};
                                callback(errorResponse);
                            }
                            else{
                                callback(response.data);
                            }
                        }
                    });
                }
                else{
                    callback(token);
                }
            }
            else{
                callback(session);
            }
        });
    };

    this.list = function(startIndex, size, fields, bypassCache, callback) {
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject) {
                privateList(startIndex, size, fields, bypassCache, function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateList(startIndex, size, fields, bypassCache, function(response){
                callback(response);
            });
        }
    };

    this.privateGetRelatedObjects = function(id, clientObjectName, startIndex, size, fields, filterParams, filterStatements, bypassCache, callback){
        HM_Log("ClientObjectType getRelated called.");
        checkConditions(true, function(session){
            if(session instanceof ISession) {
                if(!id){
                    callback(error.getErrorObject(error.MISSING_INPUT,["id"]));
                }
                else if(!clientObjectName) {
                    callback(error.getErrorObject(error.MISSING_INPUT, ["Related Object Name"]));
                }
                else{
                    session.privateGetClientObjectType(clientObjectName,function(clientObjectType){
                        if(clientObjectType instanceof IClientObjectType){
                            var token = session.privateGetAuthToken();
                            if (!(token.code && token.message)) {
                                var method  = "GET";
                                var url     = Constants.getUrl() + Constants.getRelatedServiceUrl(self.name, id, clientObjectName);
                                var headers = {"Accept":"application/json", "Authorization":"Bearer " + token};
                                var paramsAdded = 0;

                                // For Fields
                                if(fields && fields.length > 0) {
                                    var keyFieldAdded = false;
                                    for(var fieldCount=0; fieldCount < fields.length; fieldCount++) {
                                        if(paramsAdded == 1) {
                                            if(fields[fieldCount] === self.keyField) {
                                                keyFieldAdded = true;
                                            }
                                            url = url + "&fields=" + fields[fieldCount];
                                        }
                                        else {
                                            if(fields[fieldCount] === self.keyField) {
                                                keyFieldAdded = true;
                                            }
                                            url = url + "fields=" + fields[fieldCount];
                                            paramsAdded = 1;
                                        }
                                        if(!keyFieldAdded){
                                            if(paramsAdded == 1){
                                                url = url + "&fields=" + self.keyField;
                                            }
                                            else{
                                                url = url + "fields=" + self.keyField;
                                            }
                                        }
                                    }
                                }
                                // For Start Index
                                if(startIndex >=0) {
                                    if(paramsAdded == 1)
                                        url = url + "&start=" + startIndex;
                                    else {
                                        url = url + "start=" + startIndex;
                                        paramsAdded = 1;
                                    }
                                }
                                // For Size
                                if(size >=0) {

                                    if(paramsAdded == 1)
                                        url = url + "&size=" + size;
                                    else {
                                        url = url + "size=" + size;
                                        paramsAdded = 1;
                                    }
                                }
                                // For Filter Params
                                if(filterParams) {
                                    for(var key in filterParams) {
                                        if(filterParams[key] instanceof Array){
                                            for(var i = 0 ; i < filterParams[key].length ; i++){
                                                if(paramsAdded == 1)
                                                    url = url + "&" + key + "=" + filterParams[key][i];
                                                else {
                                                    url = url + key + "=" + filterParams[key][i];
                                                    paramsAdded = 1;
                                                }
                                            }
                                        }
                                        else{
                                            if(paramsAdded == 1)
                                                url = url + "&" + key + "=" + filterParams[key];
                                            else {
                                                url = url + key + "=" + filterParams[key];
                                                paramsAdded = 1;
                                            }
                                        }
                                    }
                                }
                                // For Filter Statements
                                if(filterStatements && filterStatements.length > 0) {
                                    for(var filterStatementCount=0; filterStatementCount < filterStatements.length; filterStatementCount++) {
                                        if(paramsAdded == 1)
                                            url = url + "&filter=" + filterStatements[filterStatementCount];
                                        else {
                                            url = url + "filter=" +filterStatements[filterStatementCount];
                                            paramsAdded = 1;
                                        }
                                    }
                                }
                                HM_HTTPRequest(url, method, headers, null, bypassCache, function(response){
                                    if(response.status === 200 || response.status === 204) {

                                        var array = [];
                                        var data  = response.data;

                                        if(response && data.length > 0) {

                                            for(var dataCount=0; dataCount < data.length; dataCount++) {
                                                var object = data[dataCount];
                                                var clientObject = new IClientObject(clientObjectType, object);
                                                array.push(clientObject);
                                            }
                                            callback(array);
                                        }
                                        else {
                                            callback(error.getErrorObject(error.NO_CONTENT));
                                        }
                                    }
                                    else{
                                        HM_Log(response.data);
                                        callback(response.data);
                                    }
                                });
                            }
                            else{
                                callback(token);
                            }
                        }
                        else{
                            callback(error.getErrorObject(error.INVALID_OBJECT_TYPE,["clientObjectName"]));
                        }
                    });
                }
            }
            else{
                callback(session);
            }
        });
    };

    this.getRelatedObjects = function(id, clientObjectName, startIndex, size, fields, filterParams, filterStatements, bypassCache, callback) {
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject) {
                self.privateGetRelatedObjects(id, clientObjectName, startIndex, size, fields, filterParams, filterStatements, bypassCache, function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            self.privateGetRelatedObjects(id, clientObjectName, startIndex, size, fields, filterParams, filterStatements, bypassCache, function(response){
                callback(response);
            });
        }
    };

    var privateSearch = function(startIndex, size, filterParams, fields, orderFields, orderDirective, groupFields, filterStatements, bypassCache, callback){
        HM_Log("ClientObjectType search called.");
        checkConditions(true, function(session){
            if(session instanceof ISession) {
                var token = session.privateGetAuthToken();
                if(!(token.code && token.message)){
                    var method  = "GET";
                    var url     = Constants.getUrl() + Constants.getSearchServiceUrl(self.name);
                    var headers = {"Accept":"application/json", "Authorization":"Bearer " + token};
                    var paramsAdded = 0;

                    // For Fields
                    if(fields && fields.length > 0) {
                        var keyFieldAdded = false;
                        for(var fieldCount=0; fieldCount < fields.length; fieldCount++) {
                            if(paramsAdded == 1) {
                                if(fields[fieldCount] === self.keyField) {
                                    keyFieldAdded = true;
                                }
                                url = url + "&fields=" + fields[fieldCount];
                            }
                            else {
                                if(fields[fieldCount] === self.keyField) {
                                    keyFieldAdded = true;
                                }
                                url = url + "fields=" + fields[fieldCount];
                                paramsAdded = 1;
                            }
                            if(!keyFieldAdded){
                                if(paramsAdded == 1){
                                    url = url + "&fields=" + self.keyField;
                                }
                                else{
                                    url = url + "fields=" + self.keyField;
                                }
                            }
                        }
                    }
                    // For Start Index
                    if(startIndex >=0) {

                        if(paramsAdded == 1)
                            url = url + "&start=" + startIndex;
                        else {

                            url = url + "start=" + startIndex;
                            paramsAdded = 1;
                        }
                    }
                    // For Size
                    if(size >=0) {

                        if(paramsAdded == 1)
                            url = url + "&size=" + size;
                        else {

                            url = url + "size=" + size;
                            paramsAdded = 1;
                        }
                    }
                    // For Grouped Fields
                    if(groupFields && groupFields.length > 0) {

                        for(var groupFieldCount=0; groupFieldCount < groupFields.length; groupFieldCount++) {

                            if(paramsAdded == 1)
                                url = url + "&group_field=" + groupFields[groupFieldCount];
                            else {

                                url = url + "group_field=" + groupFields[groupFieldCount];
                                paramsAdded = 1;
                            }

                        }
                    }
                    // For Order Fields
                    if(orderFields && orderFields.length > 0) {

                        for(var orderFieldCount=0; orderFieldCount < orderFields.length; orderFieldCount++) {

                            if(paramsAdded == 1)
                                url = url + "&order_field=" + orderFields[orderFieldCount];
                            else {

                                url = url + "order_field=" + orderFields[orderFieldCount];
                                paramsAdded = 1;
                            }

                        }
                    }

                    // For order directive
                    if(orderDirective) {

                        if(paramsAdded == 1)
                            url = url + "&order_directive=" + orderDirective;
                        else {

                            url = url + "order_directive=" + orderDirective;
                            paramsAdded = 1;
                        }
                    }

                    // For Filter Params
                    if(filterParams) {
                        for(var key in filterParams) {
                            if(filterParams[key] instanceof Array){
                                for(var i = 0 ; i < filterParams[key].length ; i++){
                                    if(paramsAdded == 1)
                                        url = url + "&" + key + "=" + encodeURIComponent(filterParams[key][i]);
                                    else {

                                        url = url + key + "=" + encodeURIComponent(filterParams[key][i]);
                                        paramsAdded = 1;
                                    }
                                }
                            }
                            else{
                                if(paramsAdded == 1)
                                    url = url + "&" + key + "=" + encodeURIComponent(filterParams[key]);
                                else {

                                    url = url + key + "=" + encodeURIComponent(filterParams[key]);
                                    paramsAdded = 1;
                                }
                            }
                        }
                    }
                    // For Filter Statements
                    if(filterStatements && filterStatements.length > 0) {

                        for(var filterStatementCount=0; filterStatementCount < filterStatements.length; filterStatementCount++) {

                            if(paramsAdded == 1)
                                url = url + "&filter=" + encodeURIComponent(filterStatements[filterStatementCount]);
                            else {

                                url = url + "filter=" + encodeURIComponent(filterStatements[filterStatementCount]);
                                paramsAdded = 1;
                            }
                        }
                    }

                    HM_HTTPRequest(url, method, headers, null, bypassCache, function(response){
                        if(response.data.code === 18){
                            var  errorResponse = {"code":18,"message":"Unable to connect to the Datasource, Please Check the Datasource Configuration or contact the Administrator."};
                            callback(errorResponse);
                        }
                        else{
                            callback(response.data);
                        }
                    });
                }
                else {
                    callback(token);
                }
            }
            else{
                callback(session);
            }
        });
    };

    this.search = function(startIndex, size, filterParams, fields, orderFields, orderDirective, groupFields, filterStatements, bypassCache, callback) {
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject) {
                privateSearch(startIndex, size, filterParams, fields, orderFields, orderDirective, groupFields, filterStatements, bypassCache, function(response){
                    if(!(response.code && response.message)) {
                        var array = [];
                        var data  = response;
                        if(response && data.length > 0) {
                            for(var dataCount=0; dataCount < data.length; dataCount++) {
                                var object = data[dataCount];
                                var clientObject = new IClientObject(self, object);
                                array.push(clientObject);
                            }
                            resolve(array);
                        }else {
                            reject(error.getErrorObject(error.NO_CONTENT));
                        }
                    }
                    else{
                        HM_Log(response);
                        reject(response);
                    }
                });
            });
        }
        else{
            privateSearch(startIndex, size, filterParams, fields, orderFields, orderDirective, groupFields, filterStatements, bypassCache, function(response){
                if(!(response.code && response.message)) {
                    var array = [];
                    var data  = response;
                    if(response && data.length > 0) {
                        for(var dataCount=0; dataCount < data.length; dataCount++) {
                            var object = data[dataCount];
                            var clientObject = new IClientObject(self, object);
                            array.push(clientObject);
                        }
                        callback(array);
                    }
                    else {
                        callback(error.getErrorObject(error.NO_CONTENT));
                    }
                }
                else{
                    callback(response);
                }
            });
        }
    };

    var privateGet = function (objectID, fields, bypassCache, callback){
        HM_Log("ClientObjectType getById called.");
        if(objectID === null || objectID === undefined || objectID === ""){
            callback(error.getErrorObject(error.MISSING_INPUT,["objectID"]));
        }
        else{
            checkConditions(true, function(session){
                if(session instanceof ISession) {
                    var token = session.privateGetAuthToken();
                    if(!(token.code && token.message)){
                        var method  = "GET";
                        var url     = Constants.getUrl() + Constants.getServiceUrlById(self.name, objectID);
                        var headers = {"Accept":"application/json", "Authorization":"Bearer " + token};

                        // For Fields
                        var paramsAdded = 0;
                        if(fields && fields.length > 0) {
                            for(var fieldCount=0; fieldCount < fields.length; fieldCount++) {
                                if(paramsAdded == 1) {
                                    url = url + "&fields=" + fields[fieldCount];
                                }
                                else {
                                    url = url + "?fields=" + fields[fieldCount];
                                    paramsAdded = 1;
                                }
                            }
                        }
                        HM_HTTPRequest(url, method, headers, null, bypassCache,function(response){
                            response.data.ETag = response.headers.ETag;
                            callback(response.data);
                            HM_Log(response.data);
                        });
                    }
                    else{
                        callback(token);
                    }
                }
                else {
                    callback(session);
                }
            });
        }
    };

    this.get = function(objectID, bypassCache, callback) {
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject) {
                privateGet(objectID, null, bypassCache, function(response){
                    if(!(response.code && response.message)){
                        var data  = response;
                        if(data) {
                            var clientObject = new IClientObject(self, data);
                            resolve(clientObject);
                        }else {
                            reject(error.getErrorObject(error.NO_CONTENT));
                        }
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateGet(objectID, null, bypassCache, function(response){
                if(!(response.code && response.message)){
                    var data  = response;
                    if(data) {
                        var clientObject = new IClientObject(self, data);
                        callback(clientObject);
                    }else {
                        callback(error.getErrorObject(error.NO_CONTENT));
                    }
                }
                else{
                    callback(response);
                }
            });
        }
    };

    this.getByField = function(objectID, fields, bypassCache, callback) {
        HM_Log("ClientObjectType getByField called.");
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject) {
                privateGet(objectID, fields, bypassCache, function(response){
                    if(!(response.code && response.message)){
                        var data  = response;
                        if(data) {
                            var clientObject = new IClientObject(self, data);
                            resolve(clientObject);
                        }else {
                            reject(error.getErrorObject(error.NO_CONTENT));
                        }
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateGet(objectID, fields, bypassCache, function(response){
                if(!(response.code && response.message)){
                    var data  = response;
                    if(data) {
                        var clientObject = new IClientObject(self, data);
                        callback(clientObject);
                    }else {
                        callback(error.getErrorObject(error.NO_CONTENT));
                    }
                }
                else{
                    callback(response);
                }
            });
        }
    };

    this.privateGetRequiredFieldNames = function(){
        if(!self.schema) {
            var schema = privateGetSchema();
            if(!(schema.code && schema.message)) {
                return self.requiredFields;
            }
            else{
                return schema;
            }
        }
        else{
            return self.requiredFields;
        }
    };

    this.getRequiredFieldNames = function() {
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject)
            {
                var requiredFieldNames = self.privateGetRequiredFieldNames();
                if(!(requiredFieldNames.code && requiredFieldNames.message)){
                    resolve(requiredFieldNames);
                }
                else{
                    reject(requiredFieldNames);
                }
            });
        }
        else{
            return self.privateGetRequiredFieldNames();
        }
    };

    this.privateGetFileFieldNames = function(){
        if(!self.schema) {
            var schema = privateGetSchema();
            if(!(schema.code && schema.message)) {
                return self.fileFields;
            }
            else{
                return schema;
            }
        }
        else{
            return self.fileFields;
        }
    };

    this.getFileFieldNames = function() {
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject)
            {
                var fileFieldNames = self.privateGetFileFieldNames();
                if(!(fileFieldNames.code && fileFieldNames.message)){
                    resolve(fileFieldNames);
                }
                else{
                    reject(fileFieldNames);
                }
            });
        }
        else{
            return self.privateGetFileFieldNames();
        }
    };

    this.isIdentityObject = function() {

        return isIdentityObject;
    };

    var privateGetCount = function(filterParams, filterStatements, callback){
        HM_Log("ClientObjectType getCount called.");
        checkConditions(null, function(session){
            if(session instanceof ISession) {
                var token = session.privateGetAuthToken();
                if (!(token.code && token.message)) {
                    var url = Constants.getUrl() + Constants.getSpecificServiceUrl(self.name);
                    var method = "HEAD";
                    var headers = {"Authorization": "Bearer " + token};

                    var query = "";
                    var paramAdded = 0;

                    if(filterStatements && filterStatements.length > 0) {

                        for(var filterStatementCount=0; filterStatementCount < filterStatements.length; filterStatementCount++) {

                            if(paramAdded == 1)
                                query = query + "&filter=" + filterStatements[filterStatementCount];
                            else {

                                query = query + "filter=" +filterStatements[filterStatementCount];
                                paramAdded = 1;
                            }
                        }
                    }
                    //use filterParams only when filterStatements are unavailable.
                    else if(filterParams) {
                        for(var key in filterParams) {
                            if(filterParams[key] instanceof Array){
                                for(var i = 0 ; i < filterParams[key].length ; i++){
                                    if(paramAdded == 1)
                                        query = query + "&" + key + "=" + filterParams[key][i];
                                    else {

                                        query = query + key + "=" + filterParams[key][i];
                                        paramAdded = 1;
                                    }
                                }
                            }
                            else{
                                if(paramAdded == 1)
                                    query = query + "&" + key + "=" + filterParams[key];
                                else {

                                    query = query + key + "=" + filterParams[key];
                                    paramAdded = 1;
                                }
                            }
                        }
                    }
                    if(query !== ""){
                        url = url + "?" + query;
                    }
                    HM_HTTPRequest(url, method, headers, null, true, function(response){
                        if(response.status === 200 || response.status === 204) {
                            if (response.headers['content-length'] !== undefined && response.headers['content-length'] !== null) {
                                callback(response.headers['content-length']);
                            }
                            else {
                                callback(0);
                            }
                        }
                        else{
                            HM_Log(response.data);
                            callback(response.data);
                        }
                    });
                }
                else {
                    callback(token);
                }
            }
            else{
                callback(session);
            }
        });
    };

    this.getCount = function(filterParams, filterStatements, callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateGetCount(filterParams, filterStatements, function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateGetCount(filterParams, filterStatements, function(response){
                callback(response);
            });
        }
    };

    var privateDelete = function(filterParams, filterStatements, callback){
        HM_Log("ClientObjectType filteredDelete called.");
        checkConditions(null, function(session){
            if(session instanceof ISession) {
                var token = session.privateGetAuthToken();
                if (!(token.code && token.message)) {
                    var url = Constants.getUrl() + Constants.getSpecificServiceUrl(self.name);
                    var method = "DELETE";
                    var headers = {"Authorization":"Bearer " + token};

                    var query = "";
                    var paramsAdded = 0;
                    if(filterParams) {
                        for(var key in filterParams) {
                            if(filterParams[key] instanceof Array){
                                for(var i = 0 ; i < filterParams[key].length ; i++){
                                    if(paramsAdded == 1)
                                        query = query + "&" + key + "=" + filterParams[key][i];
                                    else {

                                        query = query + key + "=" + filterParams[key][i];
                                        paramsAdded = 1;
                                    }
                                }
                            }
                            else{
                                if(paramsAdded == 1)
                                    query = query + "&" + key + "=" + filterParams[key];
                                else {

                                    query = query + key + "=" + filterParams[key];
                                    paramsAdded = 1;
                                }
                            }
                        }
                    }

                    // For Filter Statements
                    if(filterStatements && filterStatements.length > 0) {

                        for(var filterStatementCount=0; filterStatementCount < filterStatements.length; filterStatementCount++) {

                            if(paramsAdded == 1)
                                query = query + "&filter=" + encodeURIComponent(filterStatements[filterStatementCount]);
                            else {

                                query = query + "filter=" + encodeURIComponent(filterStatements[filterStatementCount]);
                                paramsAdded = 1;
                            }
                        }
                    }

                    url = url + "?" + query;
                    HM_HTTPRequest(url,method,headers,null,true, function(response){
                        callback(response.data);
                    });
                }
                else{
                    callback(token);
                }
            }
            else{
                callback(session);
            }
        });
    };

    var privateUpdate = function(filterParams, object, callback){
        HM_Log("ClientObjectType filteredUpdate called.");
        checkConditions(null, function(session){
            if(session instanceof ISession) {
                var token = session.privateGetAuthToken();
                if (!(token.code && token.message)) {
                    var url = Constants.getUrl() + Constants.getSpecificServiceUrl(self.name) + "/update";
                    var method = "POST";
                    var headers = {"Authorization":"Bearer " + token,"Content-type":"application/x-www-form-urlencoded"};

                    var query = "";
                    var data = "";
                    var paramsAdded = 0;
                    var dataAdded = 0;

                    if(object === null || object === undefined){
                        callback(error.getErrorObject(error.MISSING_INPUT,["object"]));
                    }
                    else{
                        for(var key1 in object){
                            if(dataAdded == 1)
                                data = data + "&" + key1 + "=" + object[key1];
                            else {

                                data = data + key1 + "=" + object[key1];
                                dataAdded = 1;
                            }
                        }
                        if(filterParams) {
                            for(var key in filterParams) {
                                if(filterParams[key] instanceof Array){
                                    for(var i = 0 ; i < filterParams[key].length ; i++){
                                        if(paramsAdded == 1)
                                            query = query + "&" + key + "=" + filterParams[key][i];
                                        else {

                                            query = query + key + "=" + filterParams[key][i];
                                            paramsAdded = 1;
                                        }
                                    }
                                }
                                else{
                                    if(paramsAdded == 1)
                                        query = query + "&" + key + "=" + filterParams[key];
                                    else {

                                        query = query + key + "=" + filterParams[key];
                                        paramsAdded = 1;
                                    }
                                }
                            }
                        }
                        url = url + "?" + query;
                        HM_HTTPRequest(url,method,headers,data,true,function(response){
                            callback(response.data);
                        });
                    }
                }
                else{
                    callback(token);
                }
            }
            else{
                callback(session);
            }
        });
    };

    this.delete = function(filterParams, filterStatements, callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateDelete(filterParams, filterStatements, function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateDelete(filterParams, filterStatements, function(response){
                callback(response);
            });
        }
    };

    this.update = function(filterParams, filterStatements, object,callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateUpdate(filterParams, filterStatements, object, function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateUpdate(filterParams, filterStatements, object, function(response){
                callback(response);
            });
        }
    };

    var privateBulkUpload = function(fileOrJson, format, operation, callback){
        HM_Log("ClientObjectType bulkUpload called.");
        if(fileOrJson === undefined || fileOrJson === null) {
            callback(error.getErrorObject(error.MISSING_INPUT,["file"]));
        }
        else if(format === null || format === undefined || format === ""){
            callback(error.getErrorObject(error.MISSING_INPUT,["format"]));
        }
        else if(operation === null || operation === undefined || operation === ""){
            callback(error.getErrorObject(error.MISSING_INPUT,["operation"]));
        }
        else{
            var isFile = Object.prototype.toString.call(fileOrJson) === "[object File]";
            var isBlob = Object.prototype.toString.call(fileOrJson) === "[object Blob]";
            var isArry = Object.prototype.toString.call(fileOrJson) === "[object Array]";
            if(!isFile && !isArry && !isBlob){
                callback(error.getErrorObject(error.INVALID_INPUT,[fileOrJson,"fileOrJson"]));
            }
            else{
                var bulkJSONFile = {};
                if(isFile || isBlob){
                    bulkJSONFile = fileOrJson;
                }
                else if(isArry){
                    if(format !== 'json'){
                        callback(error.getErrorObject(error.INVALID_INPUT,[format,"format should be json if input is a json array"]));
                        return;
                    }
                    else{
                        var json = JSON.stringify(fileOrJson);
                        try{
                            bulkJSONFile = new File([json], "upload.json", {
                                type: "text/plain"
                            });
                        }catch(e){
                            bulkJSONFile = new Blob(
                                [json], //array,
                                "upload.json",
                                { type: "text/plain"} //dictionary object
                            );
                        }
                    }
                }
                checkConditions(null,function(session){
                    if(session instanceof ISession) {
                        var token = session.privateGetAuthToken();
                        if (!(token.code && token.message)) {
                            var url = "";
                            switch(operation){
                                case HMBatchType.CREATE:
                                    url = Constants.getUrl() + Constants.getBulkCreateUrl(self.name) + "?format=" + format;
                                    break;
                                case HMBatchType.UPDATE:
                                    url = Constants.getUrl() + Constants.getBulkUpdateUrl(self.name) + "?format=" + format;
                                    break;
                                case HMBatchType.DELETE:
                                    url = Constants.getUrl() + Constants.getBulkDeleteUrl(self.name) + "?format=" + format;
                                    break;
                                case HMBatchType.UPSERT:
                                    url = Constants.getUrl() + Constants.getBulkUpsertUrl(self.name) + "?format=" + format;
                                    break;
                                default:
                                    callback(callback(error.getErrorObject(error.INVALID_INPUT,[operation,"operation"])));
                            }
                            var method = "POST";
                            var headers = {"Authorization": "Bearer " + token};
                            var formdata = new FormData();
                            formdata.append("file", bulkJSONFile);
                            HM_HTTPRequest(url, method, headers, formdata, null, function(response){
                                if(response.status === 200 || response.status === 204) {
                                    callback(response.data);
                                }
                                else if(response === null){
                                    HM_Log(response);
                                    callback(error.getErrorObject(error.UNKNOWN_ERROR));
                                }
                                else{
                                    HM_Log(response.data);
                                    callback(error.getErrorObject(response.data.code, [response.data.message]));
                                }
                            });
                        }
                        else{
                            return token;
                        }
                    }
                    else{
                        return session;
                    }
                });
            }
        }
    };

    this.bulkUpload = function(file, format, operation, callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateBulkUpload(file, format, operation, function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateBulkUpload(file, format, operation, function(response){
                callback(response);
            });
        }
    };
};var IEventLog = function(){
    var LOG_LEVEL = ["TRACE","DEBUG","WARNING","ERROR","FATAL"];

    var createStatement = "CREATE TABLE IF NOT EXISTS EventLogs(logLevel varchar NOT NULL, action varchar, category varchar, label varchar, value varchar, timestamp varchar, appVersion varchar)";
    var insertStatement = "INSERT INTO EventLogs (logLevel, action, category, label, value, timestamp, appVersion) VALUES (?, ?, ?, ?, ?, ?, ?)";
    var deleteStatement = "DELETE FROM EventLogs";
    var selectStatement = "SELECT * FROM EventLogs";
    var countStatement = "SELECT count(*) from EventLogs";

    var setLogLevel;

    var error = EError.getInstance();

    var db = openDatabase("EventLog", "1.0", "Event Log", 1000);  // Open WebSQL Database

    var sending  = false;

    /*This method initializes the Database for storing logs*/
    this.initLogger = function()  // Function Call When Page is ready.
    {
        try {
            if (!window.openDatabase)  // Check browser is supported SQLite or not.
            {
                return -1;
            }
            else {
                ISession.getInstance().then(
                    function(session){
                        setLogLevel = session.application.log_level;
                    },
                    function(error){
                        //comenting the console.log for GY req.
                        HM_Log("Session Failed to initialize");
                    }
                );
                createTable(); // If supported then call Function for create table in SQLite
                return 1;
            }
        }
        catch (e) {
            if (e == 2) {
                // Version number mismatch.
                //comenting the console.log for GY req.
                HM_Log("Invalid database version.");
            } else {
                //comenting the console.log for GY req.
                HM_Log("Unknown error " + e + ".");
            }
            return -1;
        }
    };

    function validateLogLevel(logLevel){
        if(LOG_LEVEL.indexOf(logLevel) === -1){
            return {message:"Enter Valid Log Level"};
        }
        else if(LOG_LEVEL.indexOf(logLevel) < LOG_LEVEL.indexOf(setLogLevel)){
            return {message:"Logs lower than "+setLogLevel+" cannot be logged"};
        }
        else{
            return 1;
        }
    }

    /*Success Callback for Event Logs Table Creation*/
    function onCreateSuccess(tx,results){
        //comenting the console.log for GY req.
        HM_Log("Event Logs Table created Successfully");
    }

    var reAddLogs = function(logs){
        for(var i = 0 ; i < logs.length ; i++){
            var row = logs[i];
            insertEventLogWithDate(row.log_level,row.action,row.category,row.label,row.value,row.app_version,row.timestamp);
        }
        sending = false;
    };

    /*Success call Back on fetching the logs to be sent from DB*/
    function onSuccessSelectLogs(tx,results){
        privateGetInstance(null, null, function(session){
            if(session instanceof ISession) {
                var token = session.privateGetAuthToken();
                if(!(token.code && token.message)){
                    deleteLogs(session.application.logLevel, function(){
                        var logsToSendArray = [];
                        for(var i = 0 ; i < results.rows.length ; i++){
                            var row = results.rows.item(i);
                            var rowObj = {"level":row.logLevel,
                                "label":row.label,
                                "timestamp":row.timestamp,
                                "value":row.value,
                                "category":row.category,
                                "action":row.action,
                                "app_version": row.appVersion
                            };
                            logsToSendArray.push(rowObj);
                        }
                        var logsToSend = JSON.stringify(logsToSendArray);

                        //var fileName = "eventLogs.json";
                        //var LogsJSONFile = new Blob([logsToSend],fileName,{type: "text/plain"});
                        if(logsToSend.length !== 0){
                            var url = Constants.getUrl() + Constants.getDeviceLogsUrl();
                            var method = "POST";
                            var headers = {"Authorization":"Bearer " + token,
                                "Content-Type":"application/json"};

                            //var formdata = new FormData();
                            //formdata.append("file",LogsJSONFile);
                            HM_HTTPRequest(url,method,headers,logsToSend,null, function(response){
                                if(response === null){
                                    reAddLogs(logsToSend);
                                    return(error.getErrorObject(error.UNKNOWN_ERROR));
                                }
                                else if(response.status !== 200){
                                    reAddLogs(logsToSend);
                                    return(error.getErrorObject(response.data.code, response.data.message));
                                }
                                else{
                                    sending = false;
                                }
                            });
                        }
                    });
                }else{
                    return(token);
                }
            }
        });
    }

    /*Delegate method send the logs based on the log level and clears the sent logs from DB*/
    var sendLogs = function(){
        //comenting the console.log for GY req.
        console.log("Send Logs Called");
        db.transaction(function (tx) {
            tx.executeSql(selectStatement, [],onSuccessSelectLogs,onError);
        });
    };

    /*Success call Back for inserting new Event Log*/
    function onSuccessInsertLog(tx,results){
        db.transaction(function (tx) {
            tx.executeSql(countStatement,[],function(tx,results){
                if(results.rows.item(0)["count(*)"] >= HM_LOG_THRESHOLD && !sending){
                    sending = true;
                    sendLogs();
                }
                //comenting the console.log for GY req.
                HM_Log("Event Logged Successfully.");
                return 1;
            });
        });
    }

    /*Success call Back for Deleting logs based on Log Level*/
    function onSuccessDeleteLogs(tx, results){
        //comenting the console.log for GY req.
        HM_Log("Logs Deleted Successfully.");
    }

    /*Error callback for DB Transaction Errors*/
    function onError(tx, error)
    {
        //comenting the console.log for GY req.
        HM_Log(error.message);
    }

    /*This method creates the Table where Event logs will be inserted*/
    var createTable = function(){
        //console.log("Create Table Called.");
        db.transaction(function (tx) {
            tx.executeSql(createStatement,[],onCreateSuccess,onError);
        });
    };

    var deleteLogs = function(logLevel, callback){
        //comenting the console.log for GY req.
        /*console.log("Delete Logs called");*/
        db.transaction(function (tx) {
            tx.executeSql(deleteStatement, [],callback,onError);
        });
    };

    var insertEventLogWithDate = function(logLevel,action,category,label,value,appVersion,timestamp){
        db.transaction(function (tx) {
            tx.executeSql(insertStatement,[logLevel,action,category,label,value,timestamp,appVersion],null,onError);
        });
    };

    /*Delegate method which will insert the Event Log into the Table*/
    var insertEventLog = function(logLevel,action,category,label,value,appVersion){
        //comenting the console.log for GY req.
        /*console.log("Insert Log Called.");*/
        db.transaction(function (tx) {
            var date = new Date().toISOString();
            tx.executeSql(insertStatement,[logLevel,action,category,label,value,date,appVersion],onSuccessInsertLog,onError);
        });
    };

    /*timestamp - Time stamp for logging time(System generated).
     category - SDK Log or APP Log
     log_level - Developer can select from an Enum(TRACE, DEBUG, WARNING, ERROR, FATAL)
     action - User define action
     label - Error Message
     value - Error Code if any*/
    this.addEvent = function(logLevel,action,category,label,value, appVersion){
        var isValid = validateLogLevel(logLevel);
        if(isValid === 1){
            insertEventLog(logLevel,action,category,label,value, appVersion);
            return 1;
        }
        else{
            return isValid.message;
        }
    };

    this.flushLogs = function(){
        sendLogs();
    };

    this.getEventLogs = function(callback) {
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                db.transaction(function (tx) {
                    tx.executeSql(selectStatement, [], function(tx,logs){
                        var logsArray = [];
                        for(var i =0 ; i < logs.rows.length ; i++){
                            var row = logs.rows[i];
                            var rowObj = {"level":row.logLevel,
                                "label":row.label,
                                "timestamp":row.timestamp,
                                "value":row.value,
                                "category":row.category,
                                "action":row.action,
                                "app_version": row.appVersion
                            };
                            logsArray.push(rowObj);
                        }
                        var logsToSend = JSON.stringify(logsArray);
                        resolve(logsToSend);
                    }, function(tx, error){
                        reject(error);
                    });
                });
            });
        }
        else{
            db.transaction(function (tx) {
                tx.executeSql(selectStatement, [], function(tx,logs){
                    var logsArray = [];
                    for(var i =0 ; i < logs.rows.length ; i++){
                        var row = logs.rows[i];
                        var rowObj = {"level":row.logLevel,
                            "label":row.label,
                            "timestamp":row.timestamp,
                            "value":row.value,
                            "category":row.category,
                            "action":row.action,
                            "app_version": row.appVersion
                        };
                        logsArray.push(rowObj);
                    }
                    var logsToSend = JSON.stringify(logsArray);
                    callback(logsToSend);
                }, function(tx, error){
                    callback(error);
                });
            });
        }
    };

    var privateSendLogs = function(file, callback){
        privateGetInstance(null, null, function(session){
            if(session instanceof ISession){
                var token = session.privateGetAuthToken();
                if(!(token.code && token.message)){

                    var url = Constants.getUrl() + Constants.getDeviceLogsUrl();
                    var method = "POST";
                    var headers = {"Authorization":"Bearer " + token};

                    var formdata = new FormData();
                    formdata.append("file",file);
                    HM_HTTPRequest(url,method,headers,formdata,null, function(response){
                        if(response === null){
                            callback(error.getErrorObject(error.UNKNOWN_ERROR));
                        }
                        else if(response.status !== 200){
                            callback(error.getErrorObject(response.data.code));
                        }
                        else if(response.status === 200){
                            deleteLogs(session.application.logLevel);
                            callback(true);
                        }
                    });
                }
                else{
                    return(token);
                }
            }
            else{
                return(session);
            }
        });
    };

    this.sendLogs = function(file, callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateSendLogs(file, function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateSendLogs(function(response){
                callback(response);
            });
        }
    };

    this.getLogsCount = function(callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                db.transaction(function (tx) {
                    tx.executeSql(countStatement, [], function(tx,count){
                        resolve(count);
                    }, function(tx, error){
                        reject(error);
                    });
                });
            });
        }
        else{
            db.transaction(function (tx) {
                tx.executeSql(countStatement, [], function(tx,count){
                    callback(count);
                }, function(tx, error){
                    callback(error);
                });
            });
        }
    };
};

IEventLog.getLogger = function(){
    var logger =  new IEventLog();
    if(logger.initLogger() !== -1){
        return(logger);
    }
    else{
        return(-1);
    }
};;/**
 * Created by pradeep.kp on 28-04-2016.
 */
function IPoll(poll, answered){

    this.poll_id = null;
    this.title = null;
    this.type = null;
    this.object_id = null;
    this.object = {};
    this.choices = [];
    this.answered = false;
    this.start_time = null;
    this.end_time = null;

    var self = this;

    var error = EError.getInstance();
    /*Initialization*/
    if(poll.poll_id){
        self.poll_id = poll.poll_id;
    }
    if(poll.title){
        self.title = poll.title;
    }
    if(poll.type){
        self.type = poll.type;
    }

    if(poll.object){
        self.object = poll.object;
    }

    if(poll.object_id){
        self.object_id = poll.object_id;
    }
    if(poll.start_time){
        self.start_time = new Date(poll.start_time);
    }
    if(poll.end_time){
        self.end_time = new Date(poll.end_time);
    }
    if(answered !== null && answered !== "" && answered !== undefined){
        self.answered = true;
    }
    /*choices iteration*/
    for(var i=0; i < poll.choices.length; i++) {
        var choice = new IPollChoice(self,poll.choices[i]);
        self.choices.push(choice);
    }
    /*choices iteration*/
    /*Initialization*/

    /*Getters and setters*/
    this.getId = function (){
        return self.poll_id;
    };

    this.getTitle = function (){
        return self.title;
    };

    this.getType = function(){
        return self.type;
    };

    this.isAnswered = function(){
        return self.answered;
    };

    this.getStartTime = function(){
        return self.start_time;
    };

    this.getEndTime = function(){
        return self.end_time;
    };

    this.getObjectType = function(){
        return self.object;
    };

    this.getObjectId = function(){
        return self.object_id;
    };

    this.getChoices = function(){
        return self.choices;
    };

    this.setAnswered = function(answered){
        self.answered = answered;
    };
    /*Getters and setters*/
    var privateGetPollResults = function(bypassCache, callback){
        privateGetInstance(null,null,function(session){
            if(session instanceof ISession) {
                var token = session.privateGetAuthToken();
                if(!(token.code && token.message)) {
                    var url = Constants.getUrl() + Constants.getPollResultsUrl(self.getTitle());
                    var method = "GET";
                    var headers = {
                        "Content-type": "application/x-www-form-urlencoded",
                        "Accept": "application/json",
                        "Authorization": "Bearer " + token
                    };
                    HM_HTTPRequest(url, method, headers, null, bypassCache, function(response){
                        if(response.status === 200){
                            callback(response.data);
                        }
                        else if(response.status === 204){
                            var emptyMap = {};
                            callback(emptyMap);
                        }
                        else{
                            callback(response.data);
                        }
                    });
                }
                else{
                    callback(token);
                }
            }
            else{
                callback(session);
            }
        });
    };

    this.getPollResults = function(bypassCache, callback) {
        if(HM_PROMISE_ENABLED){
            return new Promise(function (resolve, reject) {
                HM_Log("get poll results called");
                privateGetPollResults(bypassCache, function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateGetPollResults(bypassCache, function(response){
                callback(response);
            });
        }
    };

    var privatePostPollAnswer = function (choices, callback){
        if (choices === null || choice === {} || choice === undefined) {
            callback(error.getErrorObject(error.MISSING_INPUT, ["Poll Choice"]));
            return;
        }

        for(var i = 0 ; i < choices.length ; i++){
            if(choices[i].getPoll() !== self){
                callback(error.getErrorObject(error.INVALID_INPUT, ["Poll Choice"]));
                return;
            }
        }

        privateGetInstance(null,null,function(session){
            if (session instanceof ISession) {
                var token = session.privateGetAuthToken();
                if (!(token.code && token.message)) {
                    var params = [];
                    var headers = {
                        "Content-type": "application/x-www-form-urlencoded",
                        "Accept": "application/json",
                        "Authorization": "Bearer " + token
                    };
                    var paramAdded = 0;
                    var isWordCloudType = (self.getType() === EPollType.WORD_CLOUD);
                    var pollChoiceIds = [];
                    for(i=0; i < choices.length; i++){
                        pollChoiceIds.push(choices[i].poll_choice_id);
                        if(isWordCloudType && (choices[i].getWordCloudResponse() !== null || choices[i].getWordCloudResponse() !== "" || choices[i].getWordCloudResponse() !== undefined)){
                            var key = "text_" + choices[i].poll_choice_id;
                            var value = choices[i].getWordCloudResponse();
                            var paramToPush = key + "=" + value;
                            if(paramAdded === 0){
                                params = paramToPush;
                                paramAdded = 1;
                            }
                            else{
                                params = params + "&" + paramToPush;
                            }
                            //deinitialize the variable;
                            paramToPush = "";
                        }
                    }
                    var choiceIds = "";
                    var choicesAdded = 0;
                    for(var k = 0 ; k < pollChoiceIds.length ; k++){
                        if(choicesAdded === 0){
                            choiceIds = choiceIds + "poll_choice_id=" + pollChoiceIds[k];
                            choicesAdded = 1;
                        }
                        else{
                            choiceIds = choiceIds + "&poll_choice_id=" + pollChoiceIds[k];
                        }
                    }

                    if(paramAdded === 0){
                        params = choiceIds;
                        paramAdded = 1;
                    }
                    else{
                        params = params + "&" + choiceIds;
                    }

                    var url = Constants.getUrl() + Constants.getPollChoiceResponseURL(self.getTitle());
                    var method = "POST";

                    HM_HTTPRequest(url,method,headers,params,true,function(response){
                        if(response.status === 200){
                            resolve(response.data);
                        }
                        else if(response === null){
                            callback(error.getErrorObject(24,"Unexpected Poll error"));
                        }
                        else{
                            callback(error.getErrorObject(response.data.code,response.data.message));
                        }
                    });
                }
                else{
                    callback(token);
                }
            }
            else{
                callback(session);
            }
        });
    };

    this.postPollAnswer = function(choices, callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function (resolve, reject) {
                privatePostPollAnswer(choices,function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else {
            privatePostPollAnswer(choices,function(response){
                callback(response);
            });
        }
    };

    var privateGetPollResponses = function(startTime, endTime, bypassCache, callback){
        HM_Log("get poll results for duration called");
        if(startTime === null  || startTime === "" || startTime === undefined){
            callback(error.getErrorObject(error.MISSING_INPUT, ["Start time"]));
            return;
        }
        if(endTime === null  || endTime === "" || endTime === undefined){
            callback(error.getErrorObject(error.MISSING_INPUT, ["End Time"]));
            return;
        }
        privateGetInstance(null,null, function(session){
            if(session instanceof ISession) {
                var token = session.privateGetAuthToken();
                if (!(token.code && token.message)) {
                    var url = Constants.getUrl() + Constants.getPollResponsesUrl(self.getTitle());
                    var method = "GET";
                    var headers = {
                        "Content-type": "application/x-www-form-urlencoded",
                        "Accept": "application/json",
                        "Authorization": "Bearer " + token
                    };
                    var params = "?startTime=" + startTime + "&endTime=" + endTime;
                    url = url + params;

                    HM_HTTPRequest(url, method, headers, null, bypassCache, function(response){
                        callback(response);
                    });
                }
                else{
                    callback(token);
                }
            }
            else{
                callback(session);
            }
        });
    };

    this.getPollResponses= function(startTime, endTime, bypassCache, callback) {
        if(HM_PROMISE_ENABLED){
            return new Promise(function (resolve, reject) {
                privateGetPollResponses(startTime, endTime, bypassCache, function(response){
                    if(response.status === 200){
                        resolve(response.data);
                    }
                    else if(response.status == 204){
                        var emptyMap = {};
                        resolve(emptyMap);
                    }
                    else{
                        reject(response.data);
                    }
                });
            });
        }
        else{
            privateGetPollResponses(startTime, endTime, bypassCache, function(response){
                if(response.status == 204){
                    callback({});
                }
                else{
                    callback(response.data);
                }
            });
        }
    };

    var privateGetPollResponseAsCSV = function(startTime, endTime, bypassCache, callback){
        HM_Log("get poll results for duration called");
        if(startTime === null  || startTime === "" || startTime === undefined){
            callback(error.getErrorObject(error.MISSING_INPUT, ["Start time"]));
            return;
        }
        if(endTime === null  || endTime === "" || endTime === undefined){
            callback(error.getErrorObject(error.MISSING_INPUT, ["End Time"]));
            return;
        }
        privateGetInstance(null,null, function(session){
            if (session instanceof ISession) {
                var token = session.privateGetAuthToken();
                if (!(token.code && token.message)) {
                    var url = Constants.getUrl() + Constants.getPollResponsesUrl(self.getTitle());
                    var method = "GET";
                    var headers = {
                        "Content-type": "application/x-www-form-urlencoded",
                        "Accept": "application/octet-stream",
                        "Authorization": "Bearer " + token
                    };
                    var params = "?startTime=" + startTime + "&endTime=" + endTime;
                    url = url + params;

                    HM_HTTPRequest(url, method, headers, null, bypassCache, function(response){
                        callback(response);
                    });
                }
                else {
                    callback(token);
                }
            }
            else{
                callback(session);
            }
        });
    };

    this.getPollResponsesAsCSV = function(startTime, endTime, bypassCache, callback) {
        if(HM_PROMISE_ENABLED){
            return new Promise(function (resolve, reject) {
                privateGetPollResponseAsCSV(startTime, endTime, bypassCache, function(response){
                    if(response.status === 200){
                        var responseData = response.data;
                        if (!responseData.match(/^data:text\/csv/i)) {
                            responseData = 'data:text/csv;charset=utf-8,' + responseData;
                        }
                        var data = encodeURI(responseData);
                        var downloadLink = document.createElement('a');
                        downloadLink.setAttribute('href', data);
                        downloadLink.setAttribute('download', 'PollResponses.csv');
                        downloadLink.click();
                        downloadLink.remove();
                        resolve(true);
                    }
                    else if(response.status === 204){
                        reject(error.getErrorObject(error.NO_CONTENT));
                    }
                    else{
                        reject(error.getErrorObject(response.data.code, response.data.message));
                    }
                });
            });
        }
        else{
            privateGetPollResponseAsCSV(startTime, endTime, bypassCache, function(response){
                if(response.status === 200){
                    var responseData = response.data;
                    if (!responseData.match(/^data:text\/csv/i)) {
                        responseData = 'data:text/csv;charset=utf-8,' + responseData;
                    }
                    var data = encodeURI(responseData);
                    var downloadLink = document.createElement('a');
                    downloadLink.setAttribute('href', data);
                    downloadLink.setAttribute('download', 'PollResponses.csv');
                    downloadLink.click();
                    downloadLink.remove();
                    callback(true);
                }
                else if(response.status === 204){
                    callback(error.getErrorObject(error.NO_CONTENT));
                }
                else{
                    callback(error.getErrorObject(response.data.code, response.data.message));
                }
            });
        }
    };

    var deletePollChoice = function(choiceId, callback){
        privateGetInstance(null,null,function(session){
            if(session instanceof ISession) {
                var token = session.privateGetAuthToken();
                if(!(token.code && token.message)) {
                    var url = Constants.getUrl() + Constants.getPollChoiceDeleteUrl(self.title,choiceId);
                    var method = "DELETE";
                    var headers = {"Authorization":"Bearer " + token,
                        "Content-Type":"application/x-www-form-urlencoded"
                    };
                    HM_HTTPRequest(url,method,headers,null,true,function(response){
                        if(response.status === 200) {
                            callback(true);
                        }
                        else{
                            callback(response.data);
                        }
                    });
                }
                else{
                    callback(token);
                }
            }
            else{
                callback(session);
            }
        });
    };

    var updatePollChoice = function(url, method, headers, data, callback){
        HM_HTTPRequest(url,method,headers,data,true, function(response){
            if(response.status === 200 || response.status === 204){
                callback(true);
            }
            else{
                callback(response.data);
            }
        });
    };

    var validatePollDataForType = function(pollType, words, choices) {

        if (pollType !== 'WORD_CLOUD') {
            if (choices !== null && choices !== undefined) {
                if (pollType === 'TRUE_FALSE') {
                    if (choices.length !== 2){
                        return "There should be only two choices allowed.";
                    }
                }

                if (pollType === 'SINGLE_CHOICE_TEXT') {
                    if (choices.length === 0){
                        return "There should be atleast one choice for this type of Poll.";
                    }
                }

                if (pollType === 'MULTI_CHOICE_TEXT') {
                    if (choices.length === 0){
                        return "There should be atleast one choice for this type of Poll.";
                    }
                }

                if (pollType === 'NUMERIC_RATING') {
                    if (choices.length > 0 && choices.length <= 5) {
                        for (var i = 0; i < choices.length; i++) {
                            if (isNaN(choices[i])) {
                                return "Only Numbers are allowed for choices for this type of Poll.";
                            }
                        }
                    } else {
                        return "Choices can be a minimum of 1 and maximum of 5 for this type of Poll.";
                    }
                }
            }else{
                return "Please enter the choice for the Poll.";
            }
        }

        if(pollType === 'WORD_CLOUD'){
            if(words === 0 || words === undefined || words ===null){
                return "Provide the number of words the user can give in the responses.";
            }
        }
        return true;
    };

    var privateUpdatePoll = function(pollTitle, startDate, endDate, pollType, words, choices, objectId, objectName, callback){
        var type = ["TRUE_FALSE","MULTI_CHOICE_TEXT","SINGLE_CHOICE_TEXT","NUMERIC_RATING","WORD_CLOUD"];
        var validated = false;
        if(pollTitle === null || pollTitle === "" || pollTitle === undefined){
            callback(error.getErrorObject(error.MISSING_INPUT, ["Device Uid"]));
        }

        else if(startDate === null || startDate === "" || startDate === undefined){
            callback(error.getErrorObject(error.MISSING_INPUT, ["Device Uid"]));
        }

        else if(endDate === null || endDate === "" || endDate === undefined){
            callback(error.getErrorObject(error.MISSING_INPUT, ["Device Uid"]));
        }

        else if(pollType === null || pollType === "" || pollType === undefined){
            callback(error.getErrorObject(error.MISSING_INPUT, ["Device Uid"]));
        }

        else if(startDate > endDate){
            callback(error.getErrorObject(error.MISSING_INPUT, ["Device Uid"]));
        }

        else if(type.indexOf(pollType) === -1){
            callback(error.getErrorObject(error.MISSING_INPUT, ["Device Uid"]));
        }

        else{
            validated = validatePollDataForType(pollType, words, choices);
        }

        if(validated !== true) {
            callback({"code":61,"message":validated});
            return;
        }
        function deleteChoiceResponse(response){
            if(response !== true){
                callback(response);
                return;
            }
        }
        if(self.choices.length !== 0){
            for(var i = 0 ; i < self.choices.length; i++){
                if(self.choices[i].poll_choice_id !== undefined && self.choices[i].poll_choice_id !== null && self.choices[i].poll_choice_id !== ""){
                    deletePollChoice(self.choices[i].poll_choice_id, deleteChoiceResponse);
                }
            }
        }
        privateGetInstance(null,null, function(session){
            if(session instanceof ISession){
                var token = session.privateGetAuthToken();
                if(!(token.code && token.message)) {
                    var url = Constants.getUrl()+Constants.pollUpdateUrl(self.title);
                    var method  = "POST";
                    var headers = {"Authorization":"Bearer " + token};
                    var data = new FormData();
                    data.append("title",pollTitle);
                    data.append("start_date",startDate.toISOString());
                    data.append("end_date",endDate.toISOString());
                    data.append("type",pollType);

                    if(objectId !== null || objectId !== "" || objectId !== undefined){
                        if(objectName !== null || objectName !== "" || objectName !== undefined){
                            data.append("object",objectName);
                            data.append("object_id",objectId);
                        }
                    }

                    if((choices === null || choices.length === 0) && (words === null || words === undefined)){
                        HM_HTTPRequest(url, method, headers, data, null, function(response){
                            if(response.status === 200)
                            {
                                callback(true);
                            }
                            else{
                                callback(response.data);
                            }
                        });
                    }
                    else{
                        var j = 0;
                        var count = 0;
                        var choiceResponse = true;
                        var handleCreateChoice = function(response){
                            count++;
                            if(response !== true){
                                choiceResponse = response;
                            }
                            if(choices && count === choices.length){
                                callback(choiceResponse);
                            }
                            else if(count === Number(words)){
                                callback(choiceResponse);
                            }
                        };
                        if(pollType !== "WORD_CLOUD"){
                            for(j = 0 ; j < choices.length ; j++){
                                data.append("text",choices[j]);
                                updatePollChoice(url,method,headers,data,handleCreateChoice);
                                data.delete("text");
                            }
                        }
                        else{
                            data.append("text","");
                            for(j = 0 ; j < words ; j++){
                                updatePollChoice(url,method,headers,data,handleCreateChoice);
                            }
                        }
                    }
                }
                else{
                    callback(token);
                }
            }
            else{
                callback(session);
            }
        });
    };

    this.updatePoll = function(pollTitle, startDate, endDate, pollType, words, choices, objectId, objectName, callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateUpdatePoll(pollTitle, startDate, endDate, pollType, words, choices, objectId, objectName, function(response){
                    if(!(response.code || response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateUpdatePoll(pollTitle, startDate, endDate, pollType, words, choices, objectId, objectName, function(response){
                callback(response);
            });
        }
    };

    var privateDeletePoll = function(callback){
        privateGetInstance(null,null, function (session) {
            if(session instanceof ISession) {
                var token = session.privateGetAuthToken();
                if(!(token.code && token.error)) {
                    var url = Constants.getUrl() + Constants.pollDeleteUrl(self.getTitle());
                    var method = "DELETE";
                    var headers = {
                        "Accept": "application/json",
                        "Authorization": "Bearer " + token
                    };
                    HM_HTTPRequest(url, method, headers, null, null, function(response){
                        callback(response);
                    });
                }
                else{
                    callback(token);
                }
            }
            else{
                callback(session);
            }
        });
    };

    this.deletePoll = function(callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function (resolve, reject) {
                privateDeletePoll(function(response){
                    if(!(response.code && response.error)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateDeletePoll(function(response){
                callback(response);
            });
        }
    };
};/**
 * Created by pradeep.kp on 28-04-2016.
 */
function IPollChoice(poll, choice) {

    this.poll = {};
    this.text = null;
    this.poll_choice_id = null;
    this.image = null;
    this.wordCloudResponse = null;

    var self = this;

    /*Initialization*/
    if (poll) {
        self.poll = poll;
    }
    if (choice.text) {
        self.text = choice.text;
    }
    if (choice.poll_choice_id) {
        self.poll_choice_id = choice.poll_choice_id;
    }
    if (choice.image) {
        self.image = choice.image;
    }
    if (choice.wordCloudkey !== null && choice.wordCloudkey !== "" && choice.wordCloudkey !== undefined) {
        this.wordCloudResponse = choice.worldCloudKey.value;
    }
    /*Initialization*/
    /*getters*/
    this.getPoll = function (){
        return self.poll;
    };

    this.getText = function (){
        return self.text;
    };

    this.getImage = function (){
        return self.image;
    };

    this.getId = function () {
        return self.poll_choice_id;
    };

    this.getWordCloudResponse = function(){
        return self.wordCloudResponse;
    };
    /*getters*/


};/*
 *  Object Class For Application Using Function Prototyping
 */
var ISession = function (storedObject) {

    // init prop
    this.prop = "";
    var self = this;

    // Private Members
    this.appName = storedObject && storedObject.appName ? storedObject.appName : null;
    this.appKey = storedObject && storedObject.appKey ? storedObject.appKey : null;
    this.appSecret = storedObject && storedObject.appSecret ? storedObject.appSecret : null;
    this.appUrl = storedObject && storedObject.appUrl ? storedObject.appUrl : null;
    this.app_session = storedObject && storedObject.app_session ? storedObject.app_session : null;
    this.policy = storedObject && storedObject.policy ? new Policy(storedObject.policy.locked, storedObject.policy.locked, storedObject.policy.passcodeRequired, storedObject.policy.allowRootedAccess, storedObject.policy.registrationMode) : null;
    this.currentUser = storedObject && storedObject.currentUser ? new IUser(storedObject.currentUser.email,storedObject.currentUser.email,storedObject.currentUser.firstName,storedObject.currentUser.lastName,storedObject.currentUser.phoneNumber,storedObject.currentUser.roles,storedObject.currentUser.notificationToken) : null;

    this.saml_idp_id = storedObject && storedObject.saml_idp_id ? storedObject.saml_idp_id : null;
    this.authentication_provider = storedObject && storedObject.authentication_provider ? storedObject.authentication_provider : null;
    this.login_url = storedObject && storedObject.login_url ? storedObject.login_url : null;

    this.clientObjectTypes = storedObject && storedObject.clientObjectTypes ? storedObject.clientObjectTypes : [];

    this.authToken = storedObject && storedObject.authToken ? storedObject.authToken : null;
    this.refreshToken = storedObject && storedObject.refreshToken ? storedObject.refreshToken : null;
    this.token_type = storedObject && storedObject.token_type ? storedObject.token_type : null;
    this.tokenExpiration = storedObject && storedObject.tokenExpiration ? storedObject.tokenExpiration : null;
    this.sessionExpiration = storedObject && storedObject.tokenExpiration ? storedObject.tokenExpiration : null;

    this.is_update_alert_shown = storedObject && storedObject.is_update_alert_shown ? storedObject.is_update_alert_shown : null;
    this.allowTocheckIn = storedObject && storedObject.allowTocheckIn ? storedObject.allowTocheckIn : null;
    this.disable_crashlog_upload = storedObject && storedObject.disable_crashlog_upload ? storedObject.disable_crashlog_upload : null;
    this.loggedInUser = storedObject && storedObject.loggedInUser ? storedObject.loggedInUser : null;

    this.application = storedObject && storedObject.application ? new IApplication(storedObject.application) : null;

    this.identityObjectName = storedObject && storedObject.identityObjectName ? storedObject.identityObjectName : null;
    this.identityObjectField = storedObject && storedObject.identityObjectField ? storedObject.identityObjectField : null;
    this.identityObject = storedObject && storedObject.identityObject ? storedObject.identityObject : null;

    var error = EError.getInstance();
    // Private Members

    // Private Functions

    /*
     *  Function to refresh session
     */

    var refreshSession = function()
    {
        HM_Log("refresh session called");
        var instance;

        if(!HM_APP_KEY)
            return "App Key is missing in the global vars file";
        if(!HM_APP_SECRET)
            return "App Secret is missing in the global vars file";
        if(!HM_APP_URL)
            return "App URL is missing in the global vars file";

        instance = new ISession();

        instance.verify(null,function(response){
            if(response === 1){
                return instance;
            }
            else{
                return response;
            }
        });
    };

    var getEncryptionKey = function(callback){
        HM_Log("get Encryption key called");
        var url = Constants.getUrl() + Constants.getEncryptionKeyUrl();
        var token = self.privateGetAuthToken();
        if(!(token.code && token.message)){
            var method  = "GET";
            var headers = {"Authorization":"Bearer " + token};

            HM_HTTPRequest(url, method, headers, null, true, function(response){
                if(response.status === 200){
                    callback(response.data.key);
                }
            });
        }
        else{
            return token;
        }
    };

    /*
     * Function to remote wipe data
     */
    var remoteWipeData = function()
    {
        localStorage.clear();
    };
    /*
     *  Actual Function to get client object types
     */
    var iGetClientObjectTypes = function (callback)
    {
        HM_Log("getClientObjectTypes called");

        var tokenResponse = self.privateGetAuthToken();
        if(!(tokenResponse.code && tokenResponse.message)){
            var url     = Constants.getUrl() + Constants.getServiceUrl();
            var method  = "GET";
            var headers = {"Accept":"application/json", "Authorization":"Bearer " + tokenResponse};

            HM_HTTPRequest(url, method, headers, null, true, function(response){
                if(response.status === 200 || response.status === 204)
                {
                    self.clientObjectTypes = [];
                    var array = response.data;
                    for(var i=0; i < array.length; i++) {

                        var oneObject = array[i];
                        var clientObjectType = new IClientObjectType(oneObject.name, oneObject.schema, oneObject);

                        self.clientObjectTypes.push(clientObjectType);
                    }

                    var nativePlatforms = ['IOS','ANDROID','WINDOWS'];

                    if(nativePlatforms.indexOf(self.application.getOperatingSystem()) !== -1){
                        storeSession(true, self);
                    }
                    else{
                        storeSession(false, self);
                    }
                    callback(self.clientObjectTypes);
                }
                else
                {
                    callback(response.data);
                }
            });
        }
        else{
            callback(tokenResponse);
        }
    };
    /*
     *  Function to store instance in local storage
     */
    /*var storeSession = function (isNative)
    {
        HM_Log("session stored");
        if(!isNative){
            localStorage.removeItem(HM_APP_KEY + "_stored_session");
            localStorage.setItem(HM_APP_KEY + "_stored_session", JSON.stringify(self));
        }
        else{
            var tokenManager = TokenManager.getInstance();
            tokenManager.storedSession = JSON.stringify(self);
        }
    };*/
    /*
     *  Function to clear instance from local storage
     */
    var clearSession = function ()
    {
        HM_Log("session cleared");
        localStorage.removeItem(HM_APP_KEY + "_stored_session");
        var tokenManager = TokenManager.getInstance();
        tokenManager.storedSession = null;
    };


    var checkPolicy = function()
    {
        if(!self.policy) {
            var response = refreshSession();
            if(response instanceof ISession){
                return response.policy;
            }
            else{
                self.deleteStoredSession();
                return error.getErrorObject(error.APP_VERIFICATION_REQUIRED);
            }
        }
        else {
            return self.policy;
        }
    };

    // Private Functions

    var privateLogin = function(email, password, pin, os, platform, model, deviceUid, appSession, appVersion,  remember_user, callback){
        HM_Log("login called");
        var isError = false;
        var url     = Constants.getUrl() + Constants.getTokenUrl();
        var method  = "POST";
        var cooKie = "app_session=" + appSession;
        var headers = {"Content-Type":"application/x-www-form-urlencoded", "Accept":"*/*", };
   //     var headers = {"Content-Type":"application/x-www-form-urlencoded", "Accept":"*/*", "Cookie":cooKie};
        var data = "";

        if(deviceUid === null || deviceUid === "" || deviceUid === undefined){
            callback(error.getErrorObject(error.MISSING_INPUT, ["Device Uid"]));
            isError=true;
        }
        // Logic for Authentication Type "ANONYMOUS"
        if(self.policy.registrationMode.compareWith("ANONYMOUS")) {

            if(email === null || email === "" || email === undefined){
                callback(error.getErrorObject(error.MISSING_INPUT, ["email"]));
                isError=true;
            }
            data = "client_id=" + deviceUid + "&grant_type=password&username=" + email + "&password=";

        }
        // Logic for Authentication Type "PROVISIONED_USERS_ONLY"
        else if(self.policy.registrationMode.compareWith("PROVISIONED_USERS_ONLY")) {

            if(email === null || email === "" || email === undefined){
                callback(error.getErrorObject(error.MISSING_INPUT, ["email"]));
                isError=true;
            }

            else if(password === null || password === ""  || password === undefined){
                callback(error.getErrorObject(error.MISSING_INPUT, ["password"]));
                isError=true;
            }
            data = "client_id=" + deviceUid + "&grant_type=password&username=" + email + "&password=" + password;
        }
        // Logic for Authentication Type "REGISTRATION_WITH_PIN"
        else if(self.policy.registrationMode.compareWith("REGISTRATION_WITH_PIN")) {

            if(email === null || email === "" || email === undefined){
                callback(error.getErrorObject(error.MISSING_INPUT, ["email"]));
                isError=true;
            }

            else if(password === null || password === "" || password === undefined){
                callback(error.getErrorObject(error.MISSING_INPUT, ["password"]));
                isError=true;
            }

            else if(pin === null || pin === ""){
                callback(error.getErrorObject(error.MISSING_INPUT, ["pin"]));
                isError=true;
            }

            data = "client_id=" + deviceUid + "&grant_type=password&username=" + email + "&password=" + password + "&pin=" + pin;
        }
        // Logic for Other Authentication Types
        else {

            if(email === null || email === "" || email === undefined){
                callback(error.getErrorObject(error.MISSING_INPUT, ["email"]));
                isError=true;
            }

            else if(password === null || password === ""  || password === undefined){
                callback(error.getErrorObject(error.MISSING_INPUT, ["password"]));
                isError=true;
            }

            data =  "client_id=" + deviceUid + "&grant_type=password&username=" + email + "&password=" + password;
        }

        if(os !== null && os !== "")
            data = data + "&os=" + os;

        if(platform !== null && platform !== "")
            data = data + "&platform=" + platform.toUpperCase();

        if(model !== null && model !== "")
            data = data + "&model=" + model;

        if(appVersion !== null && appVersion !== undefined && appVersion !== "")
            data = data + "&app_version=" + appVersion;
        var policy = checkPolicy();

        if(!isError){
            if(policy instanceof Policy)
            {
                HM_HTTPRequest(url, method, headers, data, null, function(response){
                    if(response.status == 200)
                    {
                        var responseData = response.data;

                        var expiryDate = new Date();
                        expiryDate.setSeconds(expiryDate.getSeconds() + parseInt(responseData.expires_in));

                        self.sessionExpiration = expiryDate;

                        var firstName   = responseData.first_name ? responseData.first_name : "";
                        var lastName    = responseData.last_name ? responseData.last_name : "";
                        var phoneNumber = responseData.phone_number ? responseData.phone_number : "";
                        var roles = responseData.roles ? responseData.roles : [];
                        self.currentUser = new IUser(email, null, firstName, lastName, phoneNumber, roles);

                        var deviceData;
                        var usrData;
                        var application = self.application;
                        var nativePlatforms = ['IOS','ANDROID','WINDOWS'];

                        if(nativePlatforms.indexOf(application.getOperatingSystem()) !== -1){
                            storeSession(true, self);
                            var tokenManager = TokenManager.getInstance();
                            tokenManager.accessToken = responseData.access_token;
                            tokenManager.refreshToken = responseData.refresh_token;
                            tokenManager.expiresIn = Math.floor(Date.now() / 1000) + responseData.expires_in;
                            if(application.isAllowSaveCredential() && remember_user !== false){
                                getEncryptionKey(function(key){
                                        deviceData = {"platform":platform,"os":os,"model":model,"deviceUUID":deviceUid};
                                        usrData = {"username":email,"password":CryptoJS.AES.encrypt(password,key).toString()};
                                        localStorage.setItem("deviceData",JSON.stringify(deviceData));
                                        localStorage.setItem("usrData",JSON.stringify(usrData));
                                });
                            }
                        }
                        else{
                            //WEB and MOBILE WEB app case
                            storeSession(false, self);
                            localStorage.setItem(HM_TOKEN, responseData.access_token);
                            localStorage.setItem(HM_REFRESH_TOKEN, responseData.refresh_token);
                            localStorage.setItem(HM_TOKEN_EXPIRY, Math.floor(Date.now() / 1000) + responseData.expires_in);
                            if(application.isAllowSaveCredential() && remember_user !== false){
                                getEncryptionKey(function(key){
                                    deviceData = {"platform":platform,"os":os,"model":model,"deviceUUID":deviceUid};
                                    usrData = {"username":email,"password":CryptoJS.AES.encrypt(password,key).toString()};
                                    localStorage.setItem("deviceData",JSON.stringify(deviceData));
                                    localStorage.setItem("usrData",JSON.stringify(usrData));
                                });
                            }
                        }

                        if(responseData.log_level !== null || responseData.log_level !== undefined){
                            application.log_level = responseData.log_level;
                        }
                        callback(self.currentUser);
                    }
                    else
                    {
                        //error on httpRequest
                        HM_Log(response.data);
                        callback(response.data);
                    }
                });
            }
            else
            {
                //error on check policy
                callback(policy);
            }
        }
    };

    this.privateGetClientObjectType = function(name, callback){
        HM_Log("getClientObjectType called");
        var found =false;
        var returnObject;
        var oneObject;
        var i = 0;

        if(name === null || name === "" || name === undefined){
            return error.getErrorObject(error.MISSING_INPUT,["ClientObject Name"]);
        }

        HM_Log("Get client object type specific");
        if(self.clientObjectTypes.length !== 0){

            for(i=0; i < self.clientObjectTypes.length; i++) {
                oneObject = self.clientObjectTypes[i];
                var clientObjectType = new IClientObjectType(oneObject.name, oneObject.storeSchemaArray, oneObject);

                if(clientObjectType.getName() === name) {
                    returnObject = clientObjectType;
                    found = true;
                    break;
                }
            }

            if(found) {
                callback(returnObject);
            } else {
                self.clientObjectTypes = [];
                self.privateGetClientObjectType(name, function(response){
                    callback(response);
                });
            }
        }
        else{
            iGetClientObjectTypes(function(response){
                if(response.code && response.message){
                    callback(response);
                }
                if(response && response.length > 0) {

                    for(i=0; i < response.length; i++) {

                        oneObject = response[i];

                        if(oneObject.getName() === name) {

                            returnObject = oneObject;
                            found = true;
                            break;
                        }
                    }

                    if(found) {
                        callback(returnObject);
                    }
                    else {
                        callback(error.getErrorObject(error.INVALID_OBJECT_TYPE));
                    }
                }
                else{
                    callback(error.getErrorObject(error.NO_OBJECTS));
                }
            });
        }
    };

    this.privateGetAuthToken = function()
    {
        HM_Log("get auth token called");

        var tokenManager = TokenManager.getInstance();
        var tokenManagerToken = tokenManager.accessToken;

        var tokenStorageToken = localStorage.getItem(HM_TOKEN);

        // Check if policy exists
        var policy = checkPolicy();

        if(policy instanceof Policy) {
            // Check if token exists
            if (tokenManagerToken !== null && tokenManagerToken !== undefined) {
                return tokenManagerToken;
            }
            else if (tokenStorageToken !== null && tokenStorageToken !== undefined) {
                return tokenStorageToken;
            }
            else {
                return error.getErrorObject(error.TOKEN_EXPIRED);
            }
        }
        else
        {
            return policy;
        }
    };

    var privateExecuteService = function(serviceName, parameters, bypassCache, callback){
        var method = "GET";
        HM_Log("execute service " + serviceName + " called.");
        var tokenResponse = self.privateGetAuthToken();
        if(!(tokenResponse.code && tokenResponse.message))
        {
            // Validations
            if(serviceName === null || serviceName === ""){
                callback(error.getErrorObject(error.MISSING_INPUT, ["serviceName"]));
            }
            else{
                if(parameters)
                    method = "POST";

                var url = Constants.getUrl() + Constants.getServiceURL(serviceName);
                var headers = {"Accept":"application/json", "Authorization":"Bearer " + tokenResponse};
                var data = "";
                var paramsAdded = 0;
                var hasFile = false;

                for(var key in parameters) {
                    if(parameters[key] instanceof File || parameters[key] instanceof Blob){
                        hasFile = true;
                    }
                }

                if(parameters) {
                    if(hasFile){
                        headers = {"Accept":"application/json", "Authorization":"Bearer " + tokenResponse};
                        data = new FormData();

                        for(var key1 in parameters) {
                            data.append(key1, parameters[key1]);
                        }
                    }
                    else{
                        headers["Content-type"] = "application/x-www-form-urlencoded";
                        for(var key2 in parameters) {

                            if(paramsAdded == 1){
                                data = data + "&" + key2 + "=" + encodeURIComponent(parameters[key2]);
                            }
                            else {

                                data = data + key2 + "=" + encodeURIComponent(parameters[key2]);
                                paramsAdded = 1;
                            }
                        }
                    }
                }

                HM_HTTPRequest(url, method, headers, data, bypassCache,function(response){
                    callback(response);
                });
            }
        }
        else{
            callback(tokenResponse);
        }
    };

    var privateExecuteFunction = function(functionName, parameters, contentType, bypassCache, callback){
        var method = "GET";
        HM_Log("execute function " + functionName + " called.");
        var tokenResponse = self.privateGetAuthToken();
        if(!(tokenResponse.code && tokenResponse.message)){
            var url = Constants.getUrl() + Constants.getFunctionUrl(functionName);
            var headers = {};
            var error = false;
            // Validations
            if(functionName === null || functionName === "" || functionName === undefined){
                callback(error.getErrorObject(error.MISSING_INPUT, ["functionName"]));
                error = true;
            }
            else if(contentType === null || contentType === "" || contentType === undefined){
                callback(error.getErrorObject(error.MISSING_INPUT, ["contentType"]));
                error = true;
            }
            if(contentType === "url-encoded"){
                headers = {
                    "Content-Type":"application/x-www-form-urlencoded",
                    "Accept":"application/json",
                    "Authorization":"Bearer " + tokenResponse
                };
            }else if(contentType === "json"){
                headers = {
                    "Content-Type":"application/json",
                    "Accept":"application/json",
                    "Authorization":"Bearer " + tokenResponse
                };
            }else if(contentType === "formdata"){
                headers = {
                    "Accept":"application/json",
                    "Authorization":"Bearer " + tokenResponse
                };
            }else{
                callback(error.getErrorObject(error.INVALID_INPUT, ["content Type should be 'url-encoded', 'json', or 'formdata'"]));
                error = true;
            }
            if(!error){
                var data;
                var paramsAdded = 0;

                if(parameters) {
                    method = "POST";
                    if(contentType === "json"){
                        data = JSON.stringify(parameters);
                    }
                    else if(contentType === "formdata"){
                        data = new FormData();
                        for(var key1 in parameters) {
                            data.append(key1,parameters[key1]);
                        }
                    }
                    else{
                        for(var key2 in parameters) {

                            if(paramsAdded == 1)
                                data = data + "&" + key2 + "=" + encodeURIComponent(parameters[key2]);
                            else {

                                data = data + key2 + "=" + encodeURIComponent(parameters[key2]);
                                paramsAdded = 1;
                            }
                        }
                    }
                }

                HM_HTTPRequest(url, method, headers, data, bypassCache,function(response){
                    callback(response);
                });
            }
        }
        else{
            callback(tokenResponse);
        }
    };

    // Public Functions
    /*
     *  Function for verify call
     */
    this.verify = function(deviceUUID, appVersion, callback)
    {
        if(deviceUUID === null || deviceUUID === undefined || deviceUUID === ""){
            callback(error.getErrorObject(error.MISSING_INPUT, ["deviceUUID"]));
        }
        else{
            HM_DEVICE_UID = deviceUUID;
            HM_Log("verify called");
            var epoch      = new Date().getTime() + "";
            var hash       = CryptoJS.HmacSHA256(epoch, HM_APP_SECRET);
            var HmacSHA256 = CryptoJS.enc.Base64.stringify(hash);

            var url     = Constants.getUrl() + Constants.getAppUrl();
            var method  = "POST";
            var headers = {"Content-type":"application/x-www-form-urlencoded", "Accept":"application/json"};
            var data    = "app_key=" + HM_APP_KEY +"&time=" + epoch + "&signature=" + encodeURIComponent(HmacSHA256)+"&device_uid="+deviceUUID;
            if(appVersion !== null || appVersion !== undefined || appVersion !== ""){
                data = data + "&app_version="+appVersion;
            }

            HM_HTTPRequest(url, method, headers, data, null, function(response){
                if(response.status === 200 || response.status === 204){
                    var dataDictionary = {};

                    for (var key in response.data) {

                        dataDictionary[key] = response.data[key];

                        if(key == "app_session")
                            self.app_session = response.data[key];

                        if(key == "saml_idp_id")
                            self.saml_idp_id = response.data[key];

                        if(key == "authentication_provider")
                            self.authentication_provider = response.data[key];

                        if(key == "login_url")
                            self.login_url = response.data[key];

                        if(key == "disable_crashlog_upload")
                            self.disable_crashlog_upload = response.data[key];

                        if(key == "identity_service_field")
                            self.identityObjectField = response.data[key];
                    }

                    self.application = new IApplication(dataDictionary);

                    self.policy = new Policy(null, null, self.application.isPasscodeRequired(), self.application.isAllowRootedAccess(), self.application.getRegistrationMode());

                    var nativePlatforms = ['IOS','ANDROID','WINDOWS'];

                    if(self.application.isAllowSaveCredential()) {
                        if (nativePlatforms.indexOf(self.application.getOperatingSystem()) !== -1) {
                            var userData = JSON.parse(localStorage.getItem("usrData"));
                            var deviceData = JSON.parse(localStorage.getItem("deviceData"));
                            if (userData !== undefined && userData !== null) {
                                var password = CryptoJS.AES.decrypt(userData.password, response.data.key).toString(CryptoJS.enc.Utf8);
                                var userResponse = self.login(userData.username, password, null, deviceData.os, deviceData.platform, deviceData.model, deviceData.deviceUUID);
                                if(!(userResponse.data && userResponse.data.code)){
                                    storeSession(true, self);
                                    //console.log(response);
                                    callback(1);
                                }
                                else{
                                    self.deleteStoredSession();
                                    //console.log(error);
                                    callback(1);
                                }
                            }
                            else {
                                storeSession(true, self);
                                callback(1);
                            }
                        }
                        else{
                            storeSession(false, self);
                            callback(1);
                        }
                    }
                    else{
                        if (nativePlatforms.indexOf(self.application.getOperatingSystem()) !== -1){
                            storeSession(true, self);
                        }
                        else{
                            storeSession(false, self);
                        }
                        callback(1);
                    }
                }
                else{
                    var errorCode = response.data.code;
                    var errorMessage = response.data.message;
                    switch (errorCode)
                    {
                        case 34 :	self.policy = new Policy(null, true, null, null, null);
                            remoteWipeData();
                            callback(error.getErrorObject(error.USER_DEVICE_REMOTE_WIPE_LOCKED));
                            break;
                        case 25 :   callback(error.getErrorObject(error.APP_UNAVAILABLE, [errorMessage]));
                            break;
                        case 32 :	self.policy = new Policy(true, null, null, null, null);
                            callback(error.getErrorObject(error.USER_LOCKED));
                            break;
                        case 7  :	callback(error.getErrorObject(error.SIGNATURE_CHECK_ERROR, [HmacSHA256]));
                            break;

                        default :   HM_Log(response.data);
                            callback(error.getErrorObject(errorCode,[errorMessage]));
                    }
                }
            });
        }
    };
    /*
     *  Function to get current user
     */
    this.getCurrentUser = function()
    {
        var token = self.privateGetAuthToken();
        if(!(token.code && token.message)){
            return self.currentUser;
        }
        else{
            return token;
        }
    };
    /*
     *  Function to get identity object
     */
    this.getIdentityObject = function()
    {
        HM_Log("get identity object called");

        if(!self.identityObjectField) {
            return error.getErrorObject(error.IDENTITY_OBJECT_NOT_DEFINED);
        }
        var token = self.privateGetAuthToken();
        if(!(token.code && token.message)){
            if(!self.identityObjectField) {
                return error.getErrorObject(error.IDENTITY_OBJECT_NOT_DEFINED);
            }
            else{
                return self.identityObject;
            }
        }
        else {
            return token;
        }
    };
    /*
     *  Function to get identity object name
     */
    this.getIdentityObjectName = function()
    {
        HM_Log("get identity object called");
        if(!self.identityObjectField) {
            return error.getErrorObject(error.IDENTITY_OBJECT_NOT_DEFINED);
        }
        return self.identityObjectName;
    };
    /*
     *  Function to get version info
     */
    var privateGetVersionInfo = function(byPassCache, callback){
        HM_Log("get version info called");

        var url     = Constants.getUrl() + Constants.getVersionUrl();
        var method  = "GET";
        var headers = {"Accept":"application/json"};

        HM_HTTPRequest(url, method, headers, null, byPassCache, function(response){
            if(response.status === 200)
            {
                var version = {};
                version.server_version = response.data;
                version.client_version = HM_CLIENT_VERSION;
                callback(version);
            }
            else
            {
                callback(response.data);
            }
        });
    };

    this.getVersionInfo = function(bypassCache, callback)
    {
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject)
            {
                privateGetVersionInfo(bypassCache,function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateGetVersionInfo(bypassCache,function(response){
                callback(response);
            });
        }
    };
    /*
     *  Function to login
     */
    this.login = function(email, password, pin, os, platform, model, deviceUid, appSession, appVersion, remember_me, callback)
    {
        HM_Log("login called");
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject)
            {
                privateLogin(email, password, pin, os, platform, model, deviceUid, appSession, appVersion, remember_me, function(user){
                    if(user instanceof IUser){
                        resolve(user);
                    }
                    else{
                        reject(user);
                    }
                });
            });
        }
        else{
            privateLogin(email, password, pin, os, platform, model, deviceUid, appSession, appVersion, remember_me, function(user){
                callback(user);
            });
        }
    };

    /*Login for SAML or custom done for omnicom*/

    this.loginWithSamlORCustom = function(clientAssertion, providerName, platform, deviceUid,appVersion, email, code, callback)
    {
        HM_Log("saml or custom login called");
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject)
            {
                privateLoginWithSamlORCustom(clientAssertion,providerName, platform, deviceUid,appVersion, email, code,function(user){
                    if(user instanceof IUser){
                        resolve(user);
                    }
                    else{
                        reject(user);
                    }
                });
            });
        }
        else{
            privateLoginWithSamlORCustom(clientAssertion,providerName, platform, deviceUid,appVersion, email, code,function(user){
                callback(user);
            });
        }

    };

    /*function for SAML OR Custom login*/
    var privateLoginWithSamlORCustom = function(clientAssertion, providerName, platform, deviceUid,appVersion, email, code, callback){

        var url     = Constants.getUrl() + Constants.getTokenUrl();
        var method  = "POST";
        var headers = {"Content-type":"application/x-www-form-urlencoded", "Accept":"application/json"};
        var data = "";

        if(deviceUid === null || deviceUid === ""  || deviceUid === undefined){
            callback(error.getErrorObject(error.MISSING_INPUT, ["deviceUid"]));
        }

        if(self.application.operating_system != "WEB" && self.application.operating_system != "MOBILEWEB"){
            if(platform === null || platform === ""  || platform === undefined){
                callback(error.getErrorObject(error.MISSING_INPUT, ["platform"]));
            }
        }

        data =  "client_id=" + deviceUid + "&grant_type=authorization_code";

        if(clientAssertion === null || clientAssertion === "" || clientAssertion === undefined){
            if(code === null || code === "" || code === undefined){
             callback(error.getErrorObject(error.MISSING_INPUT, ["clientAssertion or Code"]));
            }
            else{
                data = data+"&code=" + code;
            }
        }
        else{
            data=data + "&client_assertion=" + encodeURIComponent(clientAssertion);
        }
       
        if(!(platform === null || platform === ""  || platform === undefined)){
            data=data+"&platform="+platform.toLowerCase();
        }
        if(!(appVersion === null || appVersion === ""  || appVersion === undefined)){
            data=data+"&app_version="+appVersion;
        }
        if(!(providerName === null || providerName === ""  || providerName === undefined)){
            data=data+"&saml_provider_name="+providerName;
        }
        if(!(email === null || email === ""  || email === undefined)){
            data=data+"&username="+email;
        }    
        //data = data + "&client_assertion=" + encodeURIComponent(clientAssertion);

        HM_HTTPRequest(url, method, headers, data, null, function(response){
            if(response.status === 200)
            {
                var responseData = response.data;

                var expiryDate = new Date();
                expiryDate.setSeconds(expiryDate.getSeconds() + parseInt(responseData.expires_in));

                self.sessionExpiration = expiryDate;

                var firstName   = responseData.first_name ? responseData.first_name : "";
                var lastName    = responseData.last_name ? responseData.last_name : "";
                var phoneNumber = responseData.phone_number ? responseData.phone_number : "";
                var username = responseData.username ? responseData.username : "";
                var email = responseData.email ? responseData.email : "";
                var roles = responseData.roles ? responseData.roles : [];
                self.currentUser = new IUser(email, username, firstName, lastName, phoneNumber, roles);

                var application = self.application;
                storeSession(false, self);
                localStorage.setItem(HM_TOKEN, responseData.access_token);
                localStorage.setItem(HM_REFRESH_TOKEN, responseData.refresh_token);
                localStorage.setItem(HM_TOKEN_EXPIRY, Math.floor(Date.now() / 1000) + responseData.expires_in);

                if(responseData.log_level !== null || responseData.log_level !== undefined){
                    application.log_level = responseData.log_level;
                }

                callback(self.currentUser);
            }
            else{
                HM_Log(response.data);
                callback(response.data);
            }
        });
    };

    /*function for SAML login*/
    var privateLoginWithSaml = function(clientAssertion, providerName, platform, deviceUid,appVersion, callback){

        var url     = Constants.getUrl() + Constants.getTokenUrl();
        var method  = "POST";
        var headers = {"Content-type":"application/x-www-form-urlencoded", "Accept":"application/json"};
        var data = "";

        if(clientAssertion === null || clientAssertion === "" || clientAssertion === undefined){
            callback(error.getErrorObject(error.MISSING_INPUT, ["clientAssertion"]));
        }

        if(deviceUid === null || deviceUid === ""  || deviceUid === undefined){
            callback(error.getErrorObject(error.MISSING_INPUT, ["deviceUid"]));
        }

        if(self.application.operating_system != "WEB" && self.application.operating_system != "MOBILEWEB"){
            if(platform === null || platform === ""  || platform === undefined){
                callback(error.getErrorObject(error.MISSING_INPUT, ["platform"]));
            }
        }

        data =  "client_id=" + deviceUid + "&grant_type=authorization_code";
        if(!(platform === null || platform === ""  || platform === undefined)){
            data=data+"&platform="+platform.toLowerCase();
        }
        if(!(appVersion === null || appVersion === ""  || appVersion === undefined)){
            data=data+"&app_version="+appVersion;
        }
        if(!(providerName === null || providerName === ""  || providerName === undefined)){
            data=data+"&saml_provider_name="+providerName;
        }
        data = data + "&client_assertion=" + encodeURIComponent(clientAssertion);

        HM_HTTPRequest(url, method, headers, data, null, function(response){
            if(response.status === 200)
            {
                var responseData = response.data;

                var expiryDate = new Date();
                expiryDate.setSeconds(expiryDate.getSeconds() + parseInt(responseData.expires_in));

                self.sessionExpiration = expiryDate;

                var firstName   = responseData.first_name ? responseData.first_name : "";
                var lastName    = responseData.last_name ? responseData.last_name : "";
                var phoneNumber = responseData.phone_number ? responseData.phone_number : "";
                var username = responseData.username ? responseData.username : "";
                var email = responseData.email ? responseData.email : "";
                var roles = responseData.roles ? responseData.roles : [];
                self.currentUser = new IUser(email, username, firstName, lastName, phoneNumber, roles);

                var application = self.application;
                storeSession(false, self);
                localStorage.setItem(HM_TOKEN, responseData.access_token);
                localStorage.setItem(HM_REFRESH_TOKEN, responseData.refresh_token);
                localStorage.setItem(HM_TOKEN_EXPIRY, Math.floor(Date.now() / 1000) + responseData.expires_in);

                if(responseData.log_level !== null || responseData.log_level !== undefined){
                    application.log_level = responseData.log_level;
                }

                callback(self.currentUser);
            }
            else{
                HM_Log(response.data);
                callback(response.data);
            }
        });
    };

    this.loginWithSaml = function(clientAssertion, platform, deviceUid, appVersion, callback){
        HM_Log("saml login called");
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject)
            {
                privateLoginWithSaml(clientAssertion,null, platform, deviceUid,appVersion,function(user){
                    if(user instanceof IUser){
                        resolve(user);
                    }
                    else{
                        reject(user);
                    }
                });
            });
        }
        else{
            privateLoginWithSaml(clientAssertion,null, platform, deviceUid,appVersion,function(user){
                callback(user);
            });
        }
    };

    this.samlLoginForProvider = function(clientAssertion, samlProviderName, platform, deviceUid, appVersion, callback){
        HM_Log("saml login for provide called");
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject)
            {
                if(samlProviderName === null || samlProviderName === undefined || samlProviderName === ""){
                    reject(error.getErrorObject(error.MISSING_INPUT, ["samlProviderName"]));
                }
                else {
                    privateLoginWithSaml(clientAssertion,samlProviderName, platform, deviceUid,appVersion,function(user){
                        if(user instanceof IUser){
                            resolve(user);
                        }
                        else{
                            reject(user);
                        }
                    });
                }
            });
        }
        else{
            if(samlProviderName === null || samlProviderName === undefined || samlProviderName === ""){
                callback(error.getErrorObject(error.MISSING_INPUT, ["samlProviderName"]));
            }
            else{
                privateLoginWithSaml(clientAssertion,samlProviderName, platform, deviceUid,appVersion,function(user){
                    callback(user);
                });
            }
        }
    };

    /*
     *  Function to register user
     */
    var privateRegisterUser = function(firstname, lastname, email, password, phoneNo, source, os, platform, model, device_uid, callback){
        HM_Log("User Register Called");

        var url     = Constants.getUrl() + Constants.getUserRegistrationURL();
        var method  = "POST";
        var headers = {"Content-type":"application/x-www-form-urlencoded", "Accept":"application/json"};
        var data = "";

        // Check if policy exists

        // Validations
        if(email === null || email === ""){
            callback(error.getErrorObject(error.MISSING_INPUT, ["email"]));
            return;
        }

        if(!self.policy.registrationMode.compareWith("UNAUTHENTICATED")) {
            if(password === null || password === ""){
                callback(error.getErrorObject(error.MISSING_INPUT, ["password"]));
                return;
            }
        }
        // Validations

        // Populate data
        //changed username to email parameter as email is mandatory parameter
        data = data + "email=" + email;

        if(!self.policy.registrationMode.compareWith("UNAUTHENTICATED"))
            data = data + "&password=" + password;

        if(!(firstname === null || firstname === "" || firstname === undefined))
            data = data + "&first_name=" + firstname;

        if(!(lastname === null || lastname === ""  || lastname === undefined ))
            data = data + "&last_name=" + lastname;

        if(!(source === null || source === "" || source === undefined))
            data = data + "&source=" + source;

        if(!(os === null || os === "" || os === undefined))
            data = data + "&os=" + os;

        if(!(platform === null || platform === "" || platform === undefined))
            data = data + "&platform=" + platform;

        if(!(model === null || model === ""  || model === undefined))
            data = data + "&model=" + model;

        if(!(phoneNo === null || phoneNo === ""  || phoneNo === undefined))
            data = data + "&phone_number=" + phoneNo;

        if(!(device_uid === null || device_uid === "" || device_uid === undefined)){
            data = data + "&device_uid=" + device_uid;
        }
        else{
            data = data + "&device_uid=" + guid();
        }
        // Populate data
        HM_HTTPRequest(url, method, headers, data, null, function(response){
            if(response.status === 200)
            {
                var eMail       = data.email ? data.email : "";
                var firstName   = data.first_name ? data.first_name : "";
                var lastName    = data.last_name ? data.last_name : "";
                var phoneNumber = data.phone_number ? data.phone_number : "";

                var user = new IUser(eMail, null, firstName, lastName, phoneNumber, null, null);

                callback(user);
            }
            else{
                callback(response.data);
            }
        });
    };

    this.registerUser = function(firstname, lastname, email, password, phoneNo, source, os, platform, model, device_uid, callback)
    {
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject)
            {
                privateRegisterUser(firstname, lastname, email, password, phoneNo, source, os, platform, model, device_uid, function(user){
                    if(user instanceof IUser){
                        resolve(user);
                    }
                    else{
                        reject(user);
                    }
                });
            });
        }
        else{
            privateRegisterUser(firstname, lastname, email, password, phoneNo, source, os, platform, model, device_uid, function(user){
                callback(user);
            });
        }
    };
    /*
     *  Function to register user with pin
     */
    var privateRegisterForPin = function(firstname, lastname, email, password, phoneNo, os, platform, model, callback){
        HM_Log("User register with pin");

        var url     = Constants.getUrl() + Constants.getUserRegistrationPinURL();
        var method  = "POST";
        var headers = {"Content-type":"application/x-www-form-urlencoded", "Accept":"application/json"};
        var data = "";

        // Check if policy exists

        // Validations
        if(email === null || email === "" || email === undefined)
            callback(error.getErrorObject(error.MISSING_INPUT, ["email"]));

        if(password === null || password === "" || password === undefined)
            callback(error.getErrorObject(error.MISSING_INPUT, ["password"]));

        if(phoneNo === null || phoneNo === "" || phoneNo === undefined)
            callback(error.getErrorObject(error.MISSING_INPUT, ["phone number"]));
        // Validations

        // Populate data
        data = data + "username=" + email + "&password=" + password + "&phone_number=" + encodeURIComponent(phoneNo);

        if(!(firstname === null || firstname === ""))
            data = data + "&first_name=" + firstname;

        if(!(lastname === null || lastname === ""))
            data = data + "&last_name=" + lastname;
        // Populate data

        if(os !== null && os !== "")
            data = data + "&os=" + os;

        if(platform !== null && platform !== "")
            data = data + "&platform=" + platform;

        if(model !== null && model !== "")
            model = model + "&model=" + model;

        HM_HTTPRequest(url, method, headers, data, null, function(response){
            callback(response);
        });
    };

    this.registerForPin = function(firstname, lastname, email, password, phoneNumber, os, platform, model, callback)
    {
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject)
            {
                privateRegisterForPin(firstname, lastname, email, password, phoneNumber, os, platform, model, function(user){
                    if(user.status === 200){
                        resolve(user.data);
                    }
                    else{
                        reject(user.data);
                    }
                });
            });
        }
        else{
            privateRegisterForPin(firstname, lastname, email, password, phoneNumber, os, platform, model, function(user){
                callback(user);
            });
        }
    };
    /*
     *	Get Expiration Date
     */
    this.getSessionExpiration = function()
    {
        return this.sessionExpiration;
    };
    /*
     *	Get Expiration Date
     */
    this.getExpirationDate = function()
    {
        return this.sessionExpiration;
    };
    /*
     *  Function to get client object type
     */
    this.getClientObjectTypes = function(callback)
    {
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject) {
                iGetClientObjectTypes(function(response){
                    if (!(response.code && response.message)) {
                        resolve(response);
                    }
                    else {
                        reject(response);
                    }
                });
            });
        }
        else{
            iGetClientObjectTypes(function(response){
                callback(response);
            });
        }
    };
    /*
     *  Function to get client specific object type
     */
    this.getClientObjectType = function(name, callback)
    {
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                self.privateGetClientObjectType(name, function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            self.privateGetClientObjectType(name, function(response){
                callback(response);
            });
        }
    };
    /*
     *  Function to get auth token
     */
    this.getAuthToken = function(callback)
    {
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject)
            {
                var response = self.privateGetAuthToken();
                if(!(response.code && response.message)){
                    resolve(response);
                }
                else{
                    reject(response);
                }
            });
        }
        else{
            callback(self.privateGetAuthToken());
        }
    };
    /*
     *  Function to execute request
     */
    this.executeService = function(serviceName, parameters, bypassCache, callback)
    {
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject)
            {
                privateExecuteService(serviceName, parameters, bypassCache, function(response){
                    if(response.status === 200 || response.status === 204){
                        resolve(response.data);
                    }
                    else{
                        reject(response.data);
                    }
                });
            });
        }
        else{
            privateExecuteService(serviceName, parameters, bypassCache, function(response){
                callback(response);
            });
        }
    };

    this.executeFunction = function(functionName, parameters, contentType, bypassCache, callback)
    {
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject)
            {
                privateExecuteFunction(functionName, parameters, contentType, bypassCache, function(response){
                    if(response.status === 200 || response.status === 204){
                        resolve(response.data);
                    }
                    else{
                        reject(response.data);
                    }
                });
            });
        }
        else{
            privateExecuteFunction(functionName, parameters, contentType, bypassCache, function(response){
                callback(response);
            });
        }
    };
    /*
     *  Function to get splash image
     */
    var privateGetSplashImage = function(bypassCache, callback){
        HM_Log("get splash image called");

        var token = self.privateGetAuthToken();
        if(!(token.code && token.message))
        {
            var url     = Constants.getUrl() + Constants.getAppUrl() + "/" + HM_APP_KEY + "?type=splash";
            var method  = "GET";
            var headers = {};

            HM_HTTPRequest(url, method, headers, null,bypassCache, function(response){
                callback(response);
            });
        }
        else{
            callback(token);
        }
    };

    this.getSplashImage = function(bypassCache, callback)
    {
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject)
            {
                privateGetSplashImage(bypassCache, function(response){
                    if(response.status === 200 || response.status === 204){
                        resolve(response.data);
                    }
                    else{
                        reject(response.data);
                    }
                });
            });
        }
        else{
            privateGetSplashImage(bypassCache, function(response){
                callback(response.data);
            });
        }
    };
    /*
     *  Function to get application
     */
    var privateGetApplication = function(){
        HM_Log("get application called");
        var application = new IApplication(self.application);
        return application;
    };

    this.getApplication = function (callback)
    {
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject)
            {
                var application = privateGetApplication();
                if(application instanceof IApplication){
                    resolve(application);
                }
                else{
                    reject(application);
                }
            });
        }
        else{
            callback(privateGetApplication());
        }
    };


    var privateGetManagedAppUsers = function(searchQuery, count, bypassCache, callback){
        HM_Log("get managed app users called");

        var token = self.privateGetAuthToken();
        if(!(token.code && token.message)){
            var url     = Constants.getUrl() + Constants.getAppUsersURL();
            var method;
            if(count)
                method  = "HEAD";
            else
                method = "GET";
            var headers = {"Accept":"application/json", "Authorization":"Bearer " + token};
            if(searchQuery){
                var paramAdded = 0;
                for(var key in searchQuery){
                    if(paramAdded === 0){
                        url = url + '?'+ key + '=' + searchQuery[key];
                        paramAdded = 1;
                    }
                    else{
                        url = url + '&'+ key + '=' + searchQuery[key];
                    }
                }
            }
            HM_HTTPRequest(url, method, headers, bypassCache, true, function(response){
                callback(response);
            });
        }
        else{
            callback(token);
        }
    };

    this.getManagedAppUsers = function (searchQuery, count, bypassCache, callback)
    {
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject)
            {
                privateGetManagedAppUsers(searchQuery, count, bypassCache, function(response){
                    if(response.status === 200){
                        if(!count){
                            resolve(response.data);
                        }
                        else{
                            if (response.headers['Content-Length'] !== undefined && response.headers['Content-Length'] !== null) {
                                resolve(response.headers['Content-Length']);
                            }
                            else {
                                resolve(0);
                            }
                        }
                    }
                    else if(response.status === 204){
                        reject(error.getErrorObject(error.NO_CONTENT));
                    }
                    else{
                        reject(response.data);
                    }
                });
            });
        }
        else{
            privateGetManagedAppUsers(searchQuery, count, bypassCache, function(response){
                callback(response.data);
            });
        }
    };

    var privateAddManagedUser = function(firstName,lastName,email,phoneNumber, callback){
        HM_Log("add Managed users called.");
        var token = self.privateGetAuthToken();
        if(!(token.code && token.message)) {
            var url = Constants.getUrl() + Constants.getAppUsersURL();
            var method = "POST";
            var headers = {"Content-type":"application/x-www-form-urlencoded", "Authorization":"Bearer " + token};

            var data = '';
            data = data+"first_name="+firstName;
            data = data+"&last_name="+lastName;
            data = data+"&email="+email;

            if(phoneNumber !== null && phoneNumber !== undefined){
                data = data+"&phone_number="+phoneNumber;
            }
            HM_HTTPRequest(url,method,headers,data,null, function(response){
                callback(response);
            });
        }
    };

    this.addManagedUser = function(firstName,lastName,email,phoneNumber, callback){
        if(HM_PROMISE_ENABLED) {
            return new Promise(function (resolve, reject) {
                privateAddManagedUser(firstName, lastName, email, phoneNumber, function(response){
                    if (response.status === 200) {
                        resolve(response.data);
                    }
                    else {
                        reject(response.data);
                    }
                });
            });
        }
        else
        {
            privateAddManagedUser(firstName, lastName, email, phoneNumber, function(response){
                callback(response.data);
            });
        }
    };

    /*
     *  Function to get announcements
     */
    var privateGetAnnouncements = function(objectName, ObjectId, pageNumber, pageSize, bypassCache, ids, callback){
        HM_Log("get announcements called");

        var token = self.privateGetAuthToken();
        if(!(token.code && token.message)){

            var url     = Constants.getUrl() + Constants.getAnnouncementUrl();
            var method  = "GET";
            var headers = {"Content-type":"application/x-www-form-urlencoded", "Accept":"application/json", "Authorization":"Bearer " + token};
            var data = "";


            if(!objectName)
                callback(error.getErrorObject(error.MISSING_INPUT, ["Object Name"]));
            else
                data = data + "object=" + objectName;

            if(!ObjectId) {
                callback(error.getErrorObject(error.MISSING_INPUT, ["Object Id"]));
            }
            else {

                if(ids && ids.length > 0)
                    for(var i=0; i < ids.length; i++)
                        data = data + "&id=" + ids[i];

                data = data + "&id=" + ObjectId;
            }

            data = data + "&start=" + pageNumber + "&size=" + pageSize;

            HM_HTTPRequest(url, method, headers, data, bypassCache, function(response){
                callback(response);
            });
        }
        else{
            callback(token);
        }
    };

    this.getAnnouncements = function (objectName, ObjectId, pageNumber, pageSize, bypassCache, ids, callback)
    {
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject)
            {
                privateGetAnnouncements(objectName, ObjectId, pageNumber, pageSize, bypassCache, ids, function(response){
                    if(response.status === 200 || response.status === 204)
                    {
                        var announcements = response.data;
                        resolve(announcements);
                    }
                    else{
                        reject(response.data);
                    }
                });
            });
        }
        else{
            privateGetAnnouncements(objectName, ObjectId, pageNumber, pageSize, bypassCache, ids, function(response){
                callback(response.data);
            });
        }
    };

    var privateAddAnnouncement = function(message, expirationTime,objectName, objectId, bypassCache, callback){
        HM_Log("add announcement called.");
        if(message === undefined || message === null || message === ""){
            callback(error.getErrorObject(error.MISSING_INPUT,["message"]));
        }
        else if(expirationTime === undefined || expirationTime === null || expirationTime === ""){
            callback(error.getErrorObject(error.MISSING_INPUT,["expirationTime"]));
        }
        else{
            var token = self.privateGetAuthToken();
            if(!(token.code && token.message)){
                var data = "";
                data = data + 'message=' + message;
                data = data + '&expiration_time=' + expirationTime;
                if(!(objectName === undefined || objectName === null || objectName === "")){
                    if(!(objectId === undefined || objectId === null || objectId === "")){
                        data = data + "&object="+ objectName +"&id=" + objectId;
                    }
                }
                var url = Constants.getUrl() + Constants.getAnnouncementUrl();
                var method = "POST";
                var headers = {"Content-type":"application/x-www-form-urlencoded", "Accept":"application/json", "Authorization":"Bearer " + token};
                HM_HTTPRequest(url,method,headers,data,bypassCache, function(response){
                    callback(response.data);
                });
            }
            else{
                callback(token);
            }
        }
    };

    this.addAnnouncement = function(message, expirationTime,objectName, objectId, bypassCache, callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject) {
                privateAddAnnouncement(message, expirationTime,objectName, objectId, bypassCache, function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateAddAnnouncement(message, expirationTime,objectName, objectId, bypassCache, function(response){
                callback(response);
            });
        }
    };

    this.deleteStoredSession = function ()
    {
        localStorage.removeItem(HM_APP_KEY + "_stored_session");
        localStorage.removeItem(HM_TOKEN);
        localStorage.removeItem(HM_REFRESH_TOKEN);
        localStorage.removeItem(HM_TOKEN_EXPIRY);

        var tokenManager = TokenManager.getInstance();
        tokenManager.storedSession = tokenManager.accessToken = tokenManager.refreshToken = tokenManager.expiresIn = null;
        localStorage.removeItem("usrData");
        localStorage.removeItem("deviceData");
    };

    var privateLogout = function (callback)
    {
        HM_Log("logout called.");
        var token = self.privateGetAuthToken();
        if(!(token.code && token.message)) {
            var url = Constants.getUrl() + Constants.getRevokeUrl();
            var method = "POST";
            var headers = {"Content-type":"application/x-www-form-urlencoded",
                "Accept":"application/json",
                "Authorization":"Bearer " + token};
            var data = "token="+token;
            HM_HTTPRequest(url,method,headers,data,null,function(response){
                if(response.status === 200 || response.status === 204){
                    localStorage.removeItem(HM_TOKEN);
                    localStorage.removeItem(HM_REFRESH_TOKEN);
                    localStorage.removeItem(HM_TOKEN_EXPIRY);

                    var tokenManager = TokenManager.getInstance();
                    tokenManager.accessToken = tokenManager.refreshToken = tokenManager.expiresIn = null;
                    localStorage.removeItem("usrData");
                    localStorage.removeItem("deviceData");

                    clearSession();
                    callback(true);
                }
                else{
                    callback(error.getErrorObject(response.data.code, [response.data.message]));
                }
            });
        }
        else{
            callback(token);
        }
    };

    this.logout = function(callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject) {
                privateLogout(function(response){
                    if(!(response.code && response.message)){
                        resolve(true);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateLogout(function(response){
                callback(response);
            });
        }
    };

    var privateGetPolls = function(startIndex, size, objectId, objectName, bypassCache, callback){
        HM_Log("get polls called");

        var token = self.privateGetAuthToken();
        if(!(token.code && token.message)) {
            var url = Constants.getUrl()+Constants.getPollUrl();
            var method  = "GET";
            var param = "";
            var headers = {"Content-type":"application/x-www-form-urlencoded",
                "Accept":"application/json",
                "Authorization":"Bearer " + token};
            if (!(startIndex !== null || startIndex !== "" || startIndex !== undefined)) {
                callback(error.getErrorObject(error.MISSING_INPUT, ["Start Index"]));
            }
            if (!(size !== null || size !== "" || size !== undefined)) {
                callback(error.getErrorObject(error.MISSING_INPUT, ["Size"]));
            }
            param = "?start=" + startIndex + "&size=" + size;

            if(objectId !== null || objectId !== "" || objectId !== undefined){
                if(objectName !== null || objectName !== "" || objectName !== undefined){
                    param = param + "&object=" + objectName + "&object_id=" + objectId;
                }
            }
            url = url + param;
            HM_HTTPRequest(url, method, headers, null, bypassCache, function(response){
                if(response.status === 200)
                {
                    var allPolls = response.data;
                    var pollArray = [];
                    for(var i = 0 ; i< allPolls.length ; i++){
                        var poll = new IPoll(allPolls[i]);
                        pollArray.push(poll);
                    }
                    callback(pollArray);
                }
                else if(response.status === 204){
                    callback(error.getErrorObject(error.NO_CONTENT));
                }
                else
                {
                    callback(response.data);
                }
            });
        }
        else{
            callback(token);
        }
    };

    var privateGetPoll = function(pollId,bypassCache, callback){
        HM_Log("get polls called");

        var token = self.privateGetAuthToken();
        if(!(token.code && token.message)) {
            var url = Constants.getUrl()+Constants.getPollUrl() + "/" + pollId;
            var method  = "GET";
            var headers = {"Content-type":"application/x-www-form-urlencoded",
                "Accept":"application/json",
                "Authorization":"Bearer " + token};

            HM_HTTPRequest(url, method, headers, null, bypassCache, function(response){
                if(response.status === 200)
                {
                    var poll = response.data;
                    poll = new IPoll(poll);
                    callback(poll);
                }
                else if(response.status === 204){
                    callback(error.getErrorObject(error.NO_CONTENT));
                }
                else
                {
                    callback(response.data);
                }
            });
        }
        else{
            callback(token);
        }
    };

    this.getPolls = function(startIndex, size, objectId, objectName, bypassCache, callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject) {
                privateGetPolls(startIndex, size, objectId, objectName, bypassCache, function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateGetPolls(startIndex, size, objectId, objectName, bypassCache, function(response){
                callback(response);
            });
        }
    };

    this.getPoll = function(pollId, bypassCache, callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject) {
                privateGetPoll(pollId, bypassCache, function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateGetPoll(pollId, bypassCache, function(response){
                callback(response);
            });
        }
    };

    var validatePollDataForType = function(pollType, words, choices) {

        if (pollType !== 'WORD_CLOUD') {
            if (choices !== null && choices !== undefined) {
                if (pollType === 'TRUE_FALSE') {
                    if (choices.length !== 2){
                        return error.getErrorObject(error.INVALID_INPUT, [choices,"choices for "+pollType]);
                    }
                }

                if (pollType === 'SINGLE_CHOICE_TEXT') {
                    if (choices.length === 0){
                        return error.getErrorObject(error.INVALID_INPUT, [choices,"choices for "+pollType]);
                    }
                }

                if (pollType === 'MULTI_CHOICE_TEXT') {
                    if (choices.length === 0){
                        return error.getErrorObject(error.INVALID_INPUT, [choices,"choices for "+pollType]);
                    }
                }

                if (pollType === 'NUMERIC_RATING') {
                    if (choices.length > 0 && choices.length <= 5) {
                        for (var i = 0; i < choices.length; i++) {
                            if (isNaN(choices[i])) {
                                return error.getErrorObject(error.INVALID_INPUT, [choices,"choices for "+pollType]);
                            }
                        }
                    } else {
                        return error.getErrorObject(error.INVALID_INPUT, [choices,"choices for "+pollType]);
                    }
                }
            }else{
                return error.getErrorObject(error.INVALID_INPUT, [choices,"choices"]);
            }
        }

        if(pollType === 'WORD_CLOUD'){
            if(words === 0 || words === undefined || words ===null){
                return error.getErrorObject(error.INVALID_INPUT, [words,"words"]);
            }
        }
        return true;
    };

    var createChoice = function(pollData,choice,token, callback){

        var url = Constants.getUrl() + Constants.getPollChoiceCreateUrl(pollData.title);
        var method = "POST";
        var headers = {"Accept":"application/json", "Authorization":"Bearer " + token};

        var formData = new FormData();
        formData.append('type', pollData.type);
        formData.append('start_date', pollData.start_time);
        formData.append('end_date', pollData.end_time);
        formData.append('text', choice);
        HM_HTTPRequest(url,method,headers,formData,false, function(response){
            callback(response);
        });
    };

    var createChoiceCloud = function(pollData,token, callback){

        var url = Constants.getUrl() + Constants.getPollChoiceCreateUrl(pollData.title);
        var method = "POST";
        var headers = {"Accept":"application/json", "Authorization":"Bearer " + token};

        var formData = new FormData();
        formData.append('type', pollData.type);
        formData.append('start_date', pollData.start_time);
        formData.append('end_date', pollData.end_time);
        formData.append('text', "");
        HM_HTTPRequest(url,method,headers,formData,false, function(response){
            callback(response);
        });
    };

    var privateAddPoll = function(pollTitle, startDate, endDate, pollType, words, choices, objectId, objectName, callback){
        HM_Log("add Poll called.");
        var type = ["TRUE_FALSE","MULTI_CHOICE_TEXT","SINGLE_CHOICE_TEXT","NUMERIC_RATING","WORD_CLOUD"];
        var validated = false;
        if(pollTitle === null || pollTitle === "" || pollTitle === undefined){
            callback(error.getErrorObject(error.MISSING_INPUT, ["pollTitle"]));
        }

        else if(startDate === null || startDate === "" || startDate === undefined){
            callback(error.getErrorObject(error.MISSING_INPUT, ["startDate"]));
        }

        else if(endDate === null || endDate === "" || endDate === undefined){
            callback(error.getErrorObject(error.MISSING_INPUT, ["endDate"]));
        }

        else if(pollType === null || pollType === "" || pollType === undefined){
            callback(error.getErrorObject(error.MISSING_INPUT, ["pollType"]));
        }

        else if(startDate > endDate){
            callback(error.getErrorObject({"code":60, "message":"Start Date should be less than end Date"}));
        }

        else if(type.indexOf(pollType) === -1){
            callback(error.getErrorObject(error.INVALID_INPUT, [pollType,"pollType"]));
        }

        else{
            validated = validatePollDataForType(pollType, words, choices);
        }

        if(validated !== true) {
            callback(validated);
        }
        else{
            var token = self.privateGetAuthToken();
            if(!(token.code && token.message)) {
                var url = Constants.getUrl()+Constants.getPollUrl();
                var method  = "POST";
                var data = "";
                var headers = {"Content-type":"application/x-www-form-urlencoded",
                    "Accept":"application/json",
                    "Authorization":"Bearer " + token};
                data = data + "title=" + encodeURIComponent(pollTitle);
                data = data + "&start_date=" + startDate.toISOString();
                data = data + "&end_date=" + endDate.toISOString();
                data = data + "&type=" + pollType;

                if(objectId !== null || objectId !== "" || objectId !== undefined){
                    if(objectName !== null || objectName !== "" || objectName !== undefined){
                        data = data + "&object=" + objectName + "&object_id=" + objectId;
                    }
                }

                var handleResponse = function(response){
                    callback(response.data);
                };

                HM_HTTPRequest(url, method, headers, data, null, function(response){
                    if(response.status === 200 || response.status === 204)
                    {
                        if(pollType !== "WORD_CLOUD"){
                            for(var choice in choices){
                                createChoice(response.data,choices[choice],token,handleResponse);
                            }
                        }
                        else {
                            for(var i =0 ; i < words ; i++){
                                createChoiceCloud(response.data,token,handleResponse);
                            }
                        }
                    }
                    else
                    {
                        callback(response.data);
                    }
                });
            }
            else{
                callback(token);
            }
        }
    };

    this.addPoll = function(pollTitle, startDate, endDate, pollType, words, choices, objectId, objectName, callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateAddPoll(pollTitle, startDate, endDate, pollType, words, choices, objectId, objectName, function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateAddPoll(pollTitle, startDate, endDate, pollType, words, choices, objectId, objectName, function(response){
                callback(response);
            });
        }
    };

    // method return three arrays related to failed operations in create, update and delete in the order.
    this.getOfflineObjects = function(){
        var offlineObjectsArray = JSON.parse(localStorage.getItem(('offline_objects')));
        var createObjectArray = [];
        var updateObjectArray = [];
        var deleteObjectArray = [];

        for(var i =0 ; i< offlineObjectsArray.length ; i++){
            if(offlineObjectsArray[i].execfailed === true){
                var tempclientObjectType = new IClientObjectType(offlineObjectsArray[i].storeObjectName,
                    offlineObjectsArray[i].storeSchemaArray, offlineObjectsArray[i].storeClientObject);

                if(offlineObjectsArray[i].operation === tempclientObjectType.HMOperationType_CREATE){
                    createObjectArray.push(offlineObjectsArray[i]);
                }
                else if(offlineObjectsArray[i].operation === tempclientObjectType.HMOperationType_UPDATE){
                    updateObjectArray.push(offlineObjectsArray[i]);
                }
                else if(offlineObjectsArray[i].operation === tempclientObjectType.HMOperationType_DELETE){
                    deleteObjectArray.push(offlineObjectsArray[i]);
                }
            }
        }
        return {"CREATE":createObjectArray,"UPDATE":updateObjectArray,"DELETE":deleteObjectArray};
    };

    var privateRecoverPassword = function(username, callback){
        if(!username)
            callback(error.getErrorObject(error.MISSING_INPUT, ["User Name or Email"]));

        var url     = Constants.getUrl() + Constants.getPasswordResetUrl();
        var method  = "POST";
        var headers = {"Content-type":"application/x-www-form-urlencoded", "Accept":"application/json"};
        var data    = "";

        data = data + "username=" + username;

        HM_HTTPRequest(url, method, headers, data, null, function(response){
            callback(response);
        });
    };

    this.recoverpassword = function (username, callback) {

        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject) {
                privateRecoverPassword(username, function(response){
                    if(response.status === 200 || response.status === 204){
                        resolve(response.data);
                    }
                    else{
                        reject(response.data);
                    }
                });
            });
        }
        else{
            privateRecoverPassword(username, function(response){
                callback(response.data);
            });
        }
    };

    this.setLogThreshold = function(thresholdValue){

        if(isNaN(thresholdValue)){
            return error.getErrorObject(error.MISSING_INPUT, ["thresholdValue"]);
        }else{
            HM_LOG_THRESHOLD = thresholdValue;
            return true;
        }
    };

    var privateGetAllApps = function(start, size, queryParams, byPassCache, callback){
        HM_Log("getAllApps called.");
        var token = self.privateGetAuthToken();
        if(!(token.code && token.message)){
            var url = Constants.getUrl() + Constants.getAppUrl();
            var method = "GET";
            var query = "?";
            var added = 0;
            if(start !== undefined || start !== null){
                query = query + "start="+start;
                added = 1;
            }
            if(size !== undefined || size !== null || added !== 0){
                query = query + "&size="+size;
            }
            else{
                query = query + "size="+size;
                added = 1;
            }

            for(var key in queryParams) {
                if(added !== 0){
                    query = query + "&" + key + "=" +queryParams[key];
                }
                else{
                    query = query + key + "=" +queryParams[key];
                }
            }

            if(query !== "?"){
                url = url + query;
            }

            var headers = {"Authorization" : "Bearer " + token};

            HM_HTTPRequest(url, method, headers, null, byPassCache, function(response){
                callback(response.data);
            });
        }
        else{
            callback(token);
        }
    };

    this.getAllApps = function(start, size , queryParams, byPassCache, callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateGetAllApps(start, size, queryParams, byPassCache, function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateGetAllApps(start, size, queryParams, byPassCache, function(response){
                callback(response);
            });
        }
    };

    var privateGetAppDesign = function(bypassCache, callback){
        var token = self.privateGetAuthToken();
        if(!(token.code && token.message)) {
            var url = Constants.getUrl() + Constants.getAppDesignURL();
            var method = "GET";
            var headers = {"Authorization" : "Bearer " + token};
            HM_HTTPRequest(url,method,headers,null,bypassCache, function(response){
                callback(response);
            });
        }
    };

    this.getAppDesign = function(byPassCache, callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateGetAppDesign(byPassCache, function(response){
                    if(response.status === 200){
                        resolve(response.data);
                    }
                    else{
                        reject(response.data);
                    }
                });
            });
        }
        else{
            privateGetAppDesign(byPassCache, function(response){
                callback(response.data);
            });
        }
    };

    var privateUpdateAppDesign = function(titleColor, bodyColor, titleTextColor,bodyTextColor,bodyHeaderColor,bodySubHeaderColor,menuColor,menuTextColor, callback){
        HM_Log("update app design called");
        var token = self.privateGetAuthToken();
        if(!(token.code && token.message)) {
            var url = Constants.getUrl() + Constants.getAppDesignURL();
            var method = "POST";
            var headers = {"Authorization" : "Bearer " + token};
            var data = new FormData();

            var paramAdded = 0;
            if(!(titleColor === undefined || titleColor === null || titleColor === "")){

                paramAdded = 1;
                data.append("title_color", titleColor);
            }

            if(!(bodyColor === undefined || bodyColor === null || bodyColor === "")){
                data.append("title_text_color", titleTextColor);
                paramAdded = 1;
            }

            if(!(titleTextColor === undefined || titleTextColor === null || titleTextColor === "")){
                data.append("body_color", bodyColor);
                paramAdded = 1;
            }

            if(!(bodyTextColor === undefined || bodyTextColor === null || bodyTextColor === "")){
                data.append("body_text_color", bodyTextColor);
                paramAdded = 1;
            }

            if(!(bodyHeaderColor === undefined || bodyHeaderColor === null || bodyHeaderColor === "")){
                data.append("body_header_color", bodyHeaderColor);
                paramAdded = 1;
            }

            if(!(bodySubHeaderColor === undefined || bodySubHeaderColor === null || bodySubHeaderColor === "")){
                data.append("body_subheader_color", bodySubHeaderColor);
                paramAdded = 1;
            }

            if(!(menuColor === undefined || menuColor === null || menuColor === "")){
                data.append("menu_color", menuColor);
                paramAdded = 1;
            }

            if(!(menuTextColor === undefined || menuTextColor === null || menuTextColor === "")){
                data.append("menu_text_color", menuTextColor);
                paramAdded = 1;
            }

            if(paramAdded === 0){
                callback(error.getErrorObject(error.NO_VALID_INPUT));
            }
            else{
                HM_HTTPRequest(url, method, headers, data, null, function(response){
                    callback(response);
                });
            }
        }
        else{
            callback(token);
        }
    };

    this.updateAppDesign = function(titleColor, bodyColor, titleTextColor,bodyTextColor,bodyHeaderColor,bodySubHeaderColor,menuColor,menuTextColor, callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateUpdateAppDesign(titleColor, bodyColor, titleTextColor,bodyTextColor,bodyHeaderColor,bodySubHeaderColor,menuColor,menuTextColor, function(response){
                    if(response.status === 200){
                        resolve(response.data);
                    }
                    else{
                        reject(response.data);
                    }
                });
            });
        }
        else{
            privateUpdateAppDesign(titleColor, bodyColor, titleTextColor,bodyTextColor,bodyHeaderColor,bodySubHeaderColor,menuColor,menuTextColor, function(response){
                callback(response.data);
            });
        }
    };

    var privateUploadSplash = function(androidSplashFile, iosSplashFile, androidIconFile, iosIconFile, callback){
        HM_Log("upload splash called");
        var token = self.privateGetAuthToken();
        if(!(token.code && token.message)) {
            var url = Constants.getUrl() + Constants.getAppDesignURL();
            var method = "POST";
            var headers = {"Authorization" : "Bearer " + token};
            var data = new FormData();

            var paramAdded = 0;
            if(!(androidSplashFile === undefined || androidSplashFile === null || androidSplashFile === "")){

                paramAdded = 1;
                data.append("android_splash_file", androidSplashFile);
            }

            if(!(iosSplashFile === undefined || iosSplashFile === null || iosSplashFile === "")){
                data.append("ios_splash_file", iosSplashFile);
                paramAdded = 1;
            }

            if(!(iosIconFile === undefined || iosIconFile === null || iosIconFile === "")){
                data.append("ios_icon_file", iosIconFile);
                paramAdded = 1;
            }

            if(!(androidIconFile === undefined || androidIconFile === null || androidIconFile === "")){
                data.append("android_icon_file", androidIconFile);
                paramAdded = 1;
            }

            if(paramAdded === 0){
                callback(error.getErrorObject(error.NO_VALID_INPUT));
            }
            else{
                HM_HTTPRequest(url, method, headers, data, null, function(response){
                    callback(response);
                });
            }
        }
        else{
            callback(token);
        }
    };

    this.uploadSplash = function(androidSplashFile, iosSplashFile, androidIconFile, iosIconFile, callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateUploadSplash(androidSplashFile, iosSplashFile, androidIconFile, iosIconFile, function(response){
                    if(response.status === 200){
                        resolve(response.data);
                    }
                    else{
                        reject(response.data);
                    }
                });
            });
        }
        else{
            privateUploadSplash(androidSplashFile, iosSplashFile, androidIconFile, iosIconFile, function(response){
                callback(response.data);
            });
        }
    };

    var privateGetAllAppCategories = function(callback){
        HM_Log("getAppCategories called");
        var token = self.privateGetAuthToken();
        if(!(token.code && token.message)) {
            var url = Constants.getUrl() + Constants.getAppCategoriesUrl();
            var method = "GET";
            var headers = {"Authorization" : "Bearer " + token};
            HM_HTTPRequest(url, method, headers, null, null, function(response){
                callback(response);
            });
        }
        else{
            callback(token);
        }
    };

    this.getAllAppCategories = function(callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateGetAllAppCategories(function(response){
                    if(response.status === 200){
                        resolve(response.data);
                    }
                    else{
                        reject(response.data);
                    }
                });
            });
        }
        else{
            privateGetAllAppCategories(function(response){
                callback(response.data);
            });
        }
    };

    this.openNotificationSocket = function(openCB, closeCB, messageCB, errorCB){
        HM_Log("opening web Socket");
        var wsObject = new HMNotification(openCB, closeCB, messageCB, errorCB);
        return wsObject;
    };

    var privateGetDeviceApplication = function(callback){
        HM_Log("get Device applications called");
        var token = self.privateGetAuthToken();
        if(!(token.code && token.message)) {
            var url = Constants.getUrl() + Constants.getDeviceApplicationUrl();
            var method = "GET";
            var headers = {"Authorization" : "Bearer " + token};
            HM_HTTPRequest(url, method, headers, null, null, function(response){
                if(response.status === 200){
                    callback(response.data);
                }
                else if(response.status === 204){
                    var emptyArray = [];
                    callback(emptyArray);
                }
                else{
                    callback(response.data);
                }
            });
        }
        else{
            callback(token);
        }
    };

    this.getDeviceApplications = function(callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateGetDeviceApplication(function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateGetDeviceApplication(function(response){
                callback(response.data);
            });
        }
    };

    var privateResetPin = function(username, password, callback){
        HM_Log("reset pin called");
        var url = Constants.getUrl() + Constants.getResendPinUrl();
        var method = "POST";
        var headers = {"Content-Type":"application/x-www-form-urlencoded"};
        var data = "";
        if(username === null || username === undefined || username === ""){
            callback(error.getErrorObject(error.MISSING_INPUT, ["username"]));
        }
        else if(password === null || password === undefined || password === ""){
            callback(error.getErrorObject(error.MISSING_INPUT, ["password"]));
        }
        else{
            data = data + "username=" + username + "&password=" + password;
            HM_HTTPRequest(url, method, headers, data, null, function(response){
                callback(response);
            });
        }
    };

    this.resetPin = function(username, password, callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateResetPin(username, password, function(response){
                    if(response.status === 200){
                        resolve(response.data);
                    }
                    else{
                        reject(response.data);
                    }
                });
            });
        }
        else{
            privateResetPin(username, password, function(response){
                callback(response.data);
            });
        }
    };

    var privateGetConfigurationData = function(objectName, filterParams, callback){
        HM_Log("get configuration fata called");
        if(objectName === null || objectName === undefined || objectName === ""){
            callback(error.getErrorObject(error.MISSING_INPUT, ["objectName"]));
        }
        else{
            var url = Constants.getUrl() + Constants.getSearchServiceUrl(objectName);
            var method = "GET";
            var headers = {"Accept":"application/json","Authorization":HM_APP_KEY+"|"+HM_APP_SECRET};
            // For Filter Params
            var paramsAdded = 0;
            if(filterParams) {
                for(var key in filterParams) {
                    if(filterParams[key] instanceof Array){
                        for(var i = 0 ; i < filterParams[key].length ; i++){
                            if(paramsAdded == 1)
                                url = url + "&" + key + "=" + filterParams[key][i];
                            else {

                                url = url + key + "=" + filterParams[key][i];
                                paramsAdded = 1;
                            }
                        }
                    }
                    else{
                        if(paramsAdded == 1)
                            url = url + "&" + key + "=" + filterParams[key];
                        else {

                            url = url + key + "=" + filterParams[key];
                            paramsAdded = 1;
                        }
                    }
                }
            }
            HM_HTTPRequest(url,method,headers,null,true,function(response){
                if(response.status === 204){
                    var emptyArray = [];
                    callback(emptyArray);
                }
                else{
                    callback(response.data);
                }
            });
        }
    };

    this.getConfigurationData = function(objectName, filterParams,callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateGetConfigurationData(objectName,filterParams,function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateGetConfigurationData(objectName,filterParams,function(response){
                callback(response);
            });
        }
    };

    var privateAddUserRole = function(roleName, users, callback){
        HM_Log("add user role called");
        if(roleName === null || roleName === undefined || roleName === ""){
            callback(error.getErrorObject(error.MISSING_INPUT, ["roleName"]));
        }
        else if(users === null || users === undefined){
            callback(error.getErrorObject(error.MISSING_INPUT, ["users"]));
        }
        else if(roleName.length === 0 || !(users instanceof Array)){
            callback(error.getErrorObject(error.INVALID_INPUT, [users,"users should be an array"]));
        }
        else{
            var token = self.privateGetAuthToken();
            if(!(token.code && token.message)) {
                var url = Constants.getUrl() + Constants.getUserRoleUrl(roleName);
                var method = "POST";
                var headers = {"Content-Type":"application/json", "Authorization" : "Bearer " + token};
                var iData = [];

                for(var key in users){
                    var user = {"email":users[key]};
                    iData.push(user);
                }
                var data = JSON.stringify(iData);
                HM_HTTPRequest(url,method,headers,data,null,function(response){
                    callback(response.data);
                });
            }
            else{
                callback(token);
            }
        }
    };

    this.addUserRole = function(roleName, users, callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateAddUserRole(roleName, users,function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateAddUserRole(roleName, users,function(response){
                callback(response);
            });
        }
    };

    var privateDeleteUserRole = function(roleName, userName, callback){
        HM_Log("delete user role called");
        if(roleName === null || roleName === undefined || roleName === ""){
            callback(error.getErrorObject(error.MISSING_INPUT, ["roleName"]));
        }
        else if(userName === null || userName === undefined || userName === ""){
            callback(error.getErrorObject(error.MISSING_INPUT, ["userName"]));
        }
        else{
            var token = self.privateGetAuthToken();
            if(!(token.code && token.message)) {
                var url = Constants.getUrl() + Constants.getUserRoleUrl(roleName) + "/" + userName;
                var method = "DELETE";
                var headers = {"Authorization" : "Bearer " + token};
                HM_HTTPRequest(url,method,headers,null,null,function(response){
                    callback(response.data);
                });
            }
            else{
                callback(token);
            }
        }
    };

    this.deleteUserRole = function(roleName, userName, callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateDeleteUserRole(roleName, userName,function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateDeleteUserRole(roleName, userName,function(response){
                callback(response);
            });
        }
    };

    var privateGetAppUsers = function(callback){
        HM_Log("get app users called");
        var token = self.privateGetAuthToken();
        if(!(token.code && token.message)) {
            var url = Constants.getUrl() + Constants.getUsersUrl();
            var method = "GET";
            var headers = {"Authorization" : "Bearer " + token};
            HM_HTTPRequest(url,method,headers,null,null,function(response){
                callback(response.data);
            });
        }
        else{
            callback(token);
        }
    };

    var privateGetAppRoles = function(callback){
        HM_Log("get app roles called");
        var token = self.privateGetAuthToken();
        if(!(token.code && token.message)) {
            var url = Constants.getUrl() + Constants.getRolesUrl();
            var method = "GET";
            var headers = {"Authorization" : "Bearer " + token};
            HM_HTTPRequest(url,method,headers,null,null,function(response){
                callback(response.data);
            });
        }
        else{
            callback(token);
        }
    };

    this.getAppUsers = function(callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateGetAppUsers(function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateGetAppUsers(function(response){
                callback(response);
            });
        }
    };

    this.getAppRoles = function(callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateGetAppRoles(function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateGetAppRoles(function(response){
                callback(response);
            });
        }
    };

    var privateCustomLogout = function(jsonParams, callback){
        HM_Log("get app roles called");
        var token = self.privateGetAuthToken();
        if(!(token.code && token.message)) {
            var data = "";
            var url = Constants.getUrl() + Constants.getRevokeUrl() + "/custom";
            var method = "POST";
            var headers = {"Authorization" : "Bearer " + token,"Content-Type":"application/json"};
            if(jsonParams !== null && jsonParams !== undefined && Object.keys(jsonParams).length !== 0){
                data = JSON.stringify(jsonParams);
            }
            else{
                data = JSON.stringify({});
            }
            HM_HTTPRequest(url,method,headers,data,null,function(response){
                if(response.status === 200 || response.status === 204){
                    localStorage.removeItem(HM_TOKEN);
                    localStorage.removeItem(HM_REFRESH_TOKEN);
                    localStorage.removeItem(HM_TOKEN_EXPIRY);

                    var tokenManager = TokenManager.getInstance();
                    tokenManager.accessToken = tokenManager.refreshToken = tokenManager.expiresIn = null;
                    localStorage.removeItem("usrData");
                    localStorage.removeItem("deviceData");

                    clearSession();
                    callback(true);
                }
                else{
                    callback(error.getErrorObject(response.data.code, [response.data.message]));
                }
            });
        }
        else{
            callback(token);
        }
    };

    this.customLogout = function(jsonParams, callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateCustomLogout(jsonParams, function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateCustomLogout(jsonParams, function(response){
                callback(response);
            });
        }
    };

    var privateGetLicenseInfo = function(client_id, callback){
        HM_Log("get app roles called");
        var token = self.privateGetAuthToken();
        if(!(token.code && token.message)) {
            var data = "";
            var url = Constants.getUrl() + Constants.licenseDateUrl(client_id);
            var method = "GET";
            var headers = {"Authorization" : "Bearer " + token,"Content-Type":"application/json"};

            HM_HTTPRequest(url,method,headers,data,null,function(response){
                if(response.status === 200 || response.status === 204){
                    callback(response.data);
                }
                else{
                    callback(error.getErrorObject(response.data.code, [response.data.message]));
                }
            });
        }
        else{
            callback(token);
        }
    };

    this.getLicenseInfo = function(client_id, callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateGetLicenseInfo(client_id, function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateGetLicenseInfo(client_id, function(response){
                callback(response);
            });
        }
    };

    var privateCustomRecoverPassword = function(serviceName, params, callback){
        HM_Log("privateCustomRecoverPassword called");
        if(serviceName === null || serviceName === undefined || serviceName === ""){
            callback(error.getErrorObject(error.MISSING_INPUT, ["serviceName"]));
        }
        else{
            var data = {};
            var url = Constants.getUrl() + Constants.getCustomRevokeURL();
            var method = "POST";
            var headers = {"Content-Type":"application/json"};
            data.serviceName = serviceName;

            if(params instanceof Object && Object.keys(params).length !== 0){
                var keys = Object.keys(params);
                for(var i = 0 ; i < keys.length ; i++){
                    data[keys[i]] = params[keys[i]];
                }
            }
            data = JSON.stringify(data);

            HM_HTTPRequest(url,method,headers,data,null,function(response){
                if(response.status === 200 || response.status === 204){
                    callback(response.data);
                }
                else{
                    callback(error.getErrorObject(response.data.code, [response.data.message]));
                }
            });
        }
    };

    this.customRecoverPassword = function(serviceName, params, callback){
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve,reject){
                privateCustomRecoverPassword(serviceName, params, function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        reject(response);
                    }
                });
            });
        }
        else{
            privateCustomRecoverPassword(serviceName, params, function(response){
                callback(response);
            });
        }
    };
    // Public Functions
};
function sessionInitialize(appKey, appSecret, appUrl, logEnabled, requestTimeOut, isPromiseEnabled){
    ISession.initialize(appKey, appSecret, appUrl, logEnabled, requestTimeOut, isPromiseEnabled);
    
    }
ISession.initialize = function (appKey, appSecret, appUrl, logEnabled, requestTimeOut, isPromiseEnabled, isRefreshEnabled, context)
{
    HM_Log("initialize called");
    HM_APP_KEY = appKey;
    HM_APP_SECRET = appSecret;
    HM_APP_URL = appUrl;
    HM_DEBUG_LOG_ENABLED  = logEnabled;
    HM_TOKEN              = HM_APP_KEY + "_token";
    HM_REFRESH_TOKEN      = HM_APP_KEY + "_refresh_token";
    HM_TOKEN_EXPIRY       = HM_APP_KEY + "_token_expiry";

    if(requestTimeOut !== undefined){
        //convert minutes in milliseconds
        HM_APP_TIMEOUT = requestTimeOut * 60 * 1000;
    }
    if(!isPromiseEnabled && isPromiseEnabled !== undefined){
        HM_PROMISE_ENABLED = false;
    }

    if(!isRefreshEnabled && isRefreshEnabled !== undefined){
        HM_REFRESH_ENABLED = false;
    }

    if(context !== undefined){
        HM_CLIENT_CONTEXT = context;
    }
};

var privateGetInstance = function(deviceUUID, appVersion, callback){
    HM_Log("get session instance called");
    var instance;
    var tokenManager = TokenManager.getInstance();
    var storedObject = JSON.parse(tokenManager.storedSession!==undefined?tokenManager.storedSession:null);

    //native app case
    if(storedObject)
    {
        instance = new ISession(storedObject);
        callback(instance);
    }
    else{
        //web and mobile web apps case
        var storedSession = localStorage.getItem(HM_APP_KEY + "_stored_session");
        storedObject = JSON.parse(storedSession);
        if(storedObject)
        {
            instance = new ISession(storedObject);
            callback(instance);
        }
        else
        {
            //no session exists
            if(!HM_APP_KEY){
                callback("App Key is missing in the global vars file");
            }
            else if(!HM_APP_SECRET){
                callback("App Secret is missing in the global vars file");
            }
            else if(!HM_APP_URL){
                callback("App URL is missing in the global vars file");
            }
            else{
                instance = new ISession();

                instance.verify(deviceUUID, appVersion, function(response){
                    if(response === 1){
                        callback(instance);
                    }
                    else{
                        callback(response);
                    }
                });
            }
        }
    }
};
function getSessionInstance(deviceuid){
    //  return "Session";
    return ISession.getInstance(deviceuid).then(function(session){
        return session;
    });
  //    return privateGetInstance();
  
  }
/*
 * Function get session instance
 */
ISession.getInstance = function (deviceUUID, appVersion, callback)
{
    if(HM_PROMISE_ENABLED){
        return new Promise(function(resolve, reject)
        {
            privateGetInstance(deviceUUID, appVersion, function(response){
                if(response instanceof ISession){
                    resolve(response);
                }
                else{
                    reject(response);
                }
            });
        });
    }
    else{
        privateGetInstance(deviceUUID, appVersion, function(response){
            callback(response);
        });
    }
};

/*Function to generate UUID or GUID*/
var guid = function() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
};;function IUser(eMail,user_name, first_name, last_name, phone_number, roles, notification_token)
{
    var self = this;
    self.username = null;
    self.firstName = null;
    self.lastName = null;
    self.password = null;
    self.phoneNumber = null;
    self.notificationToken = null;
    self.email = null;
    self.roles = [];

    var error = EError.getInstance();

    if(user_name)
        self.username = user_name;

    if(eMail)
        self.email = eMail;

    if(first_name)
        self.firstName = first_name;

    if(last_name)
        self.lastName = last_name;

    if(phone_number)
        self.phoneNumber = phone_number;

    if(notification_token)
        self.notificationToken = notification_token;

    if(roles){
        for(var role in roles){
            self.roles.push(roles[role]);
        }
    }

    function checkConditions(callback) {
        privateGetInstance(null,null,function(session){
            if(session instanceof ISession) {
                var token = session.privateGetAuthToken();
                callback(token);
            }
            else{
                callback(session);
            }
        });
    }
    
    this.getEmail = function () {
        return self.email;
    };

    this.getUsername = function () {
        return self.username;
    };

    this.getFirstName = function () {
        return self.firstName;
    };

    this.setFirstName = function (first_name) {
        self.firstName = first_name;
    };

    this.getLastName = function () {
        return self.lastName;
    };

    this.setLastName = function (last_name) {
        self.lastName = last_name;
    };

    this.getTelephoneNumber = function () {
        return self.phoneNumber;
    };

    this.setTelephoneNumber = function (phone_number) {
        self.phoneNumber = phone_number;
    };

    this.setNotificationToken = function (notification_token) {
        self.notificationToken = notification_token;
    };

    this.getRoles = function(){
        return self.roles;
    };

    var privateUpdate = function(callback){
        HM_Log("User update called");
        checkConditions(function(token){
            if(!(token.code && token.message)) {

                var url     = Constants.getUrl() + Constants.getUserUpdateURL();
                var method  = "POST";
                var headers = {"Content-type":"application/x-www-form-urlencoded", "Accept":"application/json", "Authorization":"Bearer " + token};
                var data    = "";

                if(self.firstName !== null && self.firstName !== "" && self.firstName !== undefined)
                    data = data + "first_name=" + self.firstName;

                if(self.lastName !== null && self.lastName !== "" && self.lastName !== undefined)
                    data = data + "&last_name=" + self.lastName;

                if(self.phoneNumber !== null && self.phoneNumber !== ""  && self.phoneNumber !== undefined)
                    data = data + "&phone_number=" + self.phoneNumber;

                if(self.password !== null && self.password !== "" && self.password !== undefined)
                    data = data + "&password=" + self.password;

                if(self.notificationToken !== null && self.notificationToken !== "" && self.notificationToken !== undefined)
                    data = data + "&ns_device_id=" + self.notificationToken;


                HM_HTTPRequest(url, method, headers, data, null, function(response){
                    if(response.status === 200) {
                        self.firstName = response.data.first_name;
                        self.lastName = response.data.last_name;
                        self.phoneNumber = response.data.phone_number;
                        callback(self);
                    }
                    else{
                        callback(response.data);
                    }
                });
            }
            else{
                callback(token);
            }
        });
    };

    this.update = function (callback) {
        if(HM_PROMISE_ENABLED){
            return new Promise(function(resolve, reject) {
                privateUpdate(function(response){
                    if(!(response.code && response.message)){
                        resolve(response);
                    }
                    else{
                        HM_Log(response);
                        reject(response);
                    }
                });
            });
        }
        else{
            privateUpdate(function(response){
                HM_Log(response);
                callback(response);
            });
        }
    };
};/*  
 *  Object Class For User
 */
function Policy(locked, remoteWipe, passcodeRequired, allowRootedAccess, registrationMode)
{
	this.locked = false;
	this.remoteWipe = false;
	this.passcodeRequired = false;
	this.allowRootedAccess = false;
	this.registrationMode = null;

	if(locked)
		this.locked = locked;

	if(remoteWipe)
		this.remoteWipe = remoteWipe;

	if(allowRootedAccess)
		this.passcodeRequired = allowRootedAccess;

	if(allowRootedAccess)
		this.allowRootedAccess = allowRootedAccess;

	if(registrationMode)
		this.registrationMode = registrationMode;


	return this;

};/**
 * Created by pradeep.kp on 25-11-2016.
 */
var TokenManager = (function () {
    var instance = this;

    instance.storedSession = null;

    instance.accessToken = null;
    instance.refreshToken = null;
    instance.expiresIn = null;

    return {
        getInstance: function () {
            return instance;
        }
    };
})();;!function(t,r){"object"==typeof exports?module.exports=exports=r():"function"==typeof define&&define.amd?define([],r):t.CryptoJS=r()}(this,function(){var t=t||function(t,r){var e=Object.create||function(){function t(){}return function(r){var e;return t.prototype=r,e=new t,t.prototype=null,e}}(),i={},n=i.lib={},o=n.Base=function(){return{extend:function(t){var r=e(this);return t&&r.mixIn(t),r.hasOwnProperty("init")&&this.init!==r.init||(r.init=function(){r.$super.init.apply(this,arguments)}),r.init.prototype=r,r.$super=this,r},create:function(){var t=this.extend();return t.init.apply(t,arguments),t},init:function(){},mixIn:function(t){for(var r in t)t.hasOwnProperty(r)&&(this[r]=t[r]);t.hasOwnProperty("toString")&&(this.toString=t.toString)},clone:function(){return this.init.prototype.extend(this)}}}(),s=n.WordArray=o.extend({init:function(t,e){t=this.words=t||[],this.sigBytes=e!=r?e:4*t.length},toString:function(t){return(t||c).stringify(this)},concat:function(t){var r=this.words,e=t.words,i=this.sigBytes,n=t.sigBytes;if(this.clamp(),i%4)for(var o=0;n>o;o++){var s=e[o>>>2]>>>24-o%4*8&255;r[i+o>>>2]|=s<<24-(i+o)%4*8}else for(var o=0;n>o;o+=4)r[i+o>>>2]=e[o>>>2];return this.sigBytes+=n,this},clamp:function(){var r=this.words,e=this.sigBytes;r[e>>>2]&=4294967295<<32-e%4*8,r.length=t.ceil(e/4)},clone:function(){var t=o.clone.call(this);return t.words=this.words.slice(0),t},random:function(r){for(var e,i=[],n=function(r){var r=r,e=987654321,i=4294967295;return function(){e=36969*(65535&e)+(e>>16)&i,r=18e3*(65535&r)+(r>>16)&i;var n=(e<<16)+r&i;return n/=4294967296,n+=.5,n*(t.random()>.5?1:-1)}},o=0;r>o;o+=4){var a=n(4294967296*(e||t.random()));e=987654071*a(),i.push(4294967296*a()|0)}return new s.init(i,r)}}),a=i.enc={},c=a.Hex={stringify:function(t){for(var r=t.words,e=t.sigBytes,i=[],n=0;e>n;n++){var o=r[n>>>2]>>>24-n%4*8&255;i.push((o>>>4).toString(16)),i.push((15&o).toString(16))}return i.join("")},parse:function(t){for(var r=t.length,e=[],i=0;r>i;i+=2)e[i>>>3]|=parseInt(t.substr(i,2),16)<<24-i%8*4;return new s.init(e,r/2)}},h=a.Latin1={stringify:function(t){for(var r=t.words,e=t.sigBytes,i=[],n=0;e>n;n++){var o=r[n>>>2]>>>24-n%4*8&255;i.push(String.fromCharCode(o))}return i.join("")},parse:function(t){for(var r=t.length,e=[],i=0;r>i;i++)e[i>>>2]|=(255&t.charCodeAt(i))<<24-i%4*8;return new s.init(e,r)}},l=a.Utf8={stringify:function(t){try{return decodeURIComponent(escape(h.stringify(t)))}catch(r){throw Error("Malformed UTF-8 data")}},parse:function(t){return h.parse(unescape(encodeURIComponent(t)))}},f=n.BufferedBlockAlgorithm=o.extend({reset:function(){this._data=new s.init,this._nDataBytes=0},_append:function(t){"string"==typeof t&&(t=l.parse(t)),this._data.concat(t),this._nDataBytes+=t.sigBytes},_process:function(r){var e=this._data,i=e.words,n=e.sigBytes,o=this.blockSize,a=4*o,c=n/a;c=r?t.ceil(c):t.max((0|c)-this._minBufferSize,0);var h=c*o,l=t.min(4*h,n);if(h){for(var f=0;h>f;f+=o)this._doProcessBlock(i,f);var u=i.splice(0,h);e.sigBytes-=l}return new s.init(u,l)},clone:function(){var t=o.clone.call(this);return t._data=this._data.clone(),t},_minBufferSize:0}),u=(n.Hasher=f.extend({cfg:o.extend(),init:function(t){this.cfg=this.cfg.extend(t),this.reset()},reset:function(){f.reset.call(this),this._doReset()},update:function(t){return this._append(t),this._process(),this},finalize:function(t){t&&this._append(t);var r=this._doFinalize();return r},blockSize:16,_createHelper:function(t){return function(r,e){return new t.init(e).finalize(r)}},_createHmacHelper:function(t){return function(r,e){return new u.HMAC.init(t,e).finalize(r)}}}),i.algo={});return i}(Math);/** @preserve
 (c) 2012 by Cédric Mesnil. All rights reserved.

 Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

 - Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 - Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
    /** @preserve
     * Counter block mode compatible with  Dr Brian Gladman fileenc.c
     * derived from CryptoJS.mode.CTR
     * Jan Hruby jhruby.web@gmail.com
     */
    return function(){function r(t,r,e){for(var i=[],o=0,s=0;r>s;s++)if(s%4){var a=e[t.charCodeAt(s-1)]<<s%4*2,c=e[t.charCodeAt(s)]>>>6-s%4*2;i[o>>>2]|=(a|c)<<24-o%4*8,o++}return n.create(i,o)}{var e=t,i=e.lib,n=i.WordArray,o=e.enc;o.Base64={stringify:function(t){var r=t.words,e=t.sigBytes,i=this._map;t.clamp();for(var n=[],o=0;e>o;o+=3)for(var s=r[o>>>2]>>>24-o%4*8&255,a=r[o+1>>>2]>>>24-(o+1)%4*8&255,c=r[o+2>>>2]>>>24-(o+2)%4*8&255,h=s<<16|a<<8|c,l=0;4>l&&e>o+.75*l;l++)n.push(i.charAt(h>>>6*(3-l)&63));var f=i.charAt(64);if(f)for(;n.length%4;)n.push(f);return n.join("")},parse:function(t){var e=t.length,i=this._map,n=this._reverseMap;if(!n){n=this._reverseMap=[];for(var o=0;o<i.length;o++)n[i.charCodeAt(o)]=o}var s=i.charAt(64);if(s){var a=t.indexOf(s);-1!==a&&(e=a)}return r(t,e,n)},_map:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="}}}(),function(r){function e(t,r,e,i,n,o,s){var a=t+(r&e|~r&i)+n+s;return(a<<o|a>>>32-o)+r}function i(t,r,e,i,n,o,s){var a=t+(r&i|e&~i)+n+s;return(a<<o|a>>>32-o)+r}function n(t,r,e,i,n,o,s){var a=t+(r^e^i)+n+s;return(a<<o|a>>>32-o)+r}function o(t,r,e,i,n,o,s){var a=t+(e^(r|~i))+n+s;return(a<<o|a>>>32-o)+r}var s=t,a=s.lib,c=a.WordArray,h=a.Hasher,l=s.algo,f=[];!function(){for(var t=0;64>t;t++)f[t]=4294967296*r.abs(r.sin(t+1))|0}();var u=l.MD5=h.extend({_doReset:function(){this._hash=new c.init([1732584193,4023233417,2562383102,271733878])},_doProcessBlock:function(t,r){for(var s=0;16>s;s++){var a=r+s,c=t[a];t[a]=16711935&(c<<8|c>>>24)|4278255360&(c<<24|c>>>8)}var h=this._hash.words,l=t[r+0],u=t[r+1],d=t[r+2],v=t[r+3],p=t[r+4],_=t[r+5],y=t[r+6],g=t[r+7],B=t[r+8],k=t[r+9],w=t[r+10],S=t[r+11],m=t[r+12],x=t[r+13],b=t[r+14],H=t[r+15],z=h[0],A=h[1],C=h[2],D=h[3];z=e(z,A,C,D,l,7,f[0]),D=e(D,z,A,C,u,12,f[1]),C=e(C,D,z,A,d,17,f[2]),A=e(A,C,D,z,v,22,f[3]),z=e(z,A,C,D,p,7,f[4]),D=e(D,z,A,C,_,12,f[5]),C=e(C,D,z,A,y,17,f[6]),A=e(A,C,D,z,g,22,f[7]),z=e(z,A,C,D,B,7,f[8]),D=e(D,z,A,C,k,12,f[9]),C=e(C,D,z,A,w,17,f[10]),A=e(A,C,D,z,S,22,f[11]),z=e(z,A,C,D,m,7,f[12]),D=e(D,z,A,C,x,12,f[13]),C=e(C,D,z,A,b,17,f[14]),A=e(A,C,D,z,H,22,f[15]),z=i(z,A,C,D,u,5,f[16]),D=i(D,z,A,C,y,9,f[17]),C=i(C,D,z,A,S,14,f[18]),A=i(A,C,D,z,l,20,f[19]),z=i(z,A,C,D,_,5,f[20]),D=i(D,z,A,C,w,9,f[21]),C=i(C,D,z,A,H,14,f[22]),A=i(A,C,D,z,p,20,f[23]),z=i(z,A,C,D,k,5,f[24]),D=i(D,z,A,C,b,9,f[25]),C=i(C,D,z,A,v,14,f[26]),A=i(A,C,D,z,B,20,f[27]),z=i(z,A,C,D,x,5,f[28]),D=i(D,z,A,C,d,9,f[29]),C=i(C,D,z,A,g,14,f[30]),A=i(A,C,D,z,m,20,f[31]),z=n(z,A,C,D,_,4,f[32]),D=n(D,z,A,C,B,11,f[33]),C=n(C,D,z,A,S,16,f[34]),A=n(A,C,D,z,b,23,f[35]),z=n(z,A,C,D,u,4,f[36]),D=n(D,z,A,C,p,11,f[37]),C=n(C,D,z,A,g,16,f[38]),A=n(A,C,D,z,w,23,f[39]),z=n(z,A,C,D,x,4,f[40]),D=n(D,z,A,C,l,11,f[41]),C=n(C,D,z,A,v,16,f[42]),A=n(A,C,D,z,y,23,f[43]),z=n(z,A,C,D,k,4,f[44]),D=n(D,z,A,C,m,11,f[45]),C=n(C,D,z,A,H,16,f[46]),A=n(A,C,D,z,d,23,f[47]),z=o(z,A,C,D,l,6,f[48]),D=o(D,z,A,C,g,10,f[49]),C=o(C,D,z,A,b,15,f[50]),A=o(A,C,D,z,_,21,f[51]),z=o(z,A,C,D,m,6,f[52]),D=o(D,z,A,C,v,10,f[53]),C=o(C,D,z,A,w,15,f[54]),A=o(A,C,D,z,u,21,f[55]),z=o(z,A,C,D,B,6,f[56]),D=o(D,z,A,C,H,10,f[57]),C=o(C,D,z,A,y,15,f[58]),A=o(A,C,D,z,x,21,f[59]),z=o(z,A,C,D,p,6,f[60]),D=o(D,z,A,C,S,10,f[61]),C=o(C,D,z,A,d,15,f[62]),A=o(A,C,D,z,k,21,f[63]),h[0]=h[0]+z|0,h[1]=h[1]+A|0,h[2]=h[2]+C|0,h[3]=h[3]+D|0},_doFinalize:function(){var t=this._data,e=t.words,i=8*this._nDataBytes,n=8*t.sigBytes;e[n>>>5]|=128<<24-n%32;var o=r.floor(i/4294967296),s=i;e[(n+64>>>9<<4)+15]=16711935&(o<<8|o>>>24)|4278255360&(o<<24|o>>>8),e[(n+64>>>9<<4)+14]=16711935&(s<<8|s>>>24)|4278255360&(s<<24|s>>>8),t.sigBytes=4*(e.length+1),this._process();for(var a=this._hash,c=a.words,h=0;4>h;h++){var l=c[h];c[h]=16711935&(l<<8|l>>>24)|4278255360&(l<<24|l>>>8)}return a},clone:function(){var t=h.clone.call(this);return t._hash=this._hash.clone(),t}});s.MD5=h._createHelper(u),s.HmacMD5=h._createHmacHelper(u)}(Math),function(){var r=t,e=r.lib,i=e.WordArray,n=e.Hasher,o=r.algo,s=[],a=o.SHA1=n.extend({_doReset:function(){this._hash=new i.init([1732584193,4023233417,2562383102,271733878,3285377520])},_doProcessBlock:function(t,r){for(var e=this._hash.words,i=e[0],n=e[1],o=e[2],a=e[3],c=e[4],h=0;80>h;h++){if(16>h)s[h]=0|t[r+h];else{var l=s[h-3]^s[h-8]^s[h-14]^s[h-16];s[h]=l<<1|l>>>31}var f=(i<<5|i>>>27)+c+s[h];f+=20>h?(n&o|~n&a)+1518500249:40>h?(n^o^a)+1859775393:60>h?(n&o|n&a|o&a)-1894007588:(n^o^a)-899497514,c=a,a=o,o=n<<30|n>>>2,n=i,i=f}e[0]=e[0]+i|0,e[1]=e[1]+n|0,e[2]=e[2]+o|0,e[3]=e[3]+a|0,e[4]=e[4]+c|0},_doFinalize:function(){var t=this._data,r=t.words,e=8*this._nDataBytes,i=8*t.sigBytes;return r[i>>>5]|=128<<24-i%32,r[(i+64>>>9<<4)+14]=Math.floor(e/4294967296),r[(i+64>>>9<<4)+15]=e,t.sigBytes=4*r.length,this._process(),this._hash},clone:function(){var t=n.clone.call(this);return t._hash=this._hash.clone(),t}});r.SHA1=n._createHelper(a),r.HmacSHA1=n._createHmacHelper(a)}(),function(r){var e=t,i=e.lib,n=i.WordArray,o=i.Hasher,s=e.algo,a=[],c=[];!function(){function t(t){for(var e=r.sqrt(t),i=2;e>=i;i++)if(!(t%i))return!1;return!0}function e(t){return 4294967296*(t-(0|t))|0}for(var i=2,n=0;64>n;)t(i)&&(8>n&&(a[n]=e(r.pow(i,.5))),c[n]=e(r.pow(i,1/3)),n++),i++}();var h=[],l=s.SHA256=o.extend({_doReset:function(){this._hash=new n.init(a.slice(0))},_doProcessBlock:function(t,r){for(var e=this._hash.words,i=e[0],n=e[1],o=e[2],s=e[3],a=e[4],l=e[5],f=e[6],u=e[7],d=0;64>d;d++){if(16>d)h[d]=0|t[r+d];else{var v=h[d-15],p=(v<<25|v>>>7)^(v<<14|v>>>18)^v>>>3,_=h[d-2],y=(_<<15|_>>>17)^(_<<13|_>>>19)^_>>>10;h[d]=p+h[d-7]+y+h[d-16]}var g=a&l^~a&f,B=i&n^i&o^n&o,k=(i<<30|i>>>2)^(i<<19|i>>>13)^(i<<10|i>>>22),w=(a<<26|a>>>6)^(a<<21|a>>>11)^(a<<7|a>>>25),S=u+w+g+c[d]+h[d],m=k+B;u=f,f=l,l=a,a=s+S|0,s=o,o=n,n=i,i=S+m|0}e[0]=e[0]+i|0,e[1]=e[1]+n|0,e[2]=e[2]+o|0,e[3]=e[3]+s|0,e[4]=e[4]+a|0,e[5]=e[5]+l|0,e[6]=e[6]+f|0,e[7]=e[7]+u|0},_doFinalize:function(){var t=this._data,e=t.words,i=8*this._nDataBytes,n=8*t.sigBytes;return e[n>>>5]|=128<<24-n%32,e[(n+64>>>9<<4)+14]=r.floor(i/4294967296),e[(n+64>>>9<<4)+15]=i,t.sigBytes=4*e.length,this._process(),this._hash},clone:function(){var t=o.clone.call(this);return t._hash=this._hash.clone(),t}});e.SHA256=o._createHelper(l),e.HmacSHA256=o._createHmacHelper(l)}(Math),function(){function r(t){return t<<8&4278255360|t>>>8&16711935}{var e=t,i=e.lib,n=i.WordArray,o=e.enc;o.Utf16=o.Utf16BE={stringify:function(t){for(var r=t.words,e=t.sigBytes,i=[],n=0;e>n;n+=2){var o=r[n>>>2]>>>16-n%4*8&65535;i.push(String.fromCharCode(o))}return i.join("")},parse:function(t){for(var r=t.length,e=[],i=0;r>i;i++)e[i>>>1]|=t.charCodeAt(i)<<16-i%2*16;return n.create(e,2*r)}}}o.Utf16LE={stringify:function(t){for(var e=t.words,i=t.sigBytes,n=[],o=0;i>o;o+=2){var s=r(e[o>>>2]>>>16-o%4*8&65535);n.push(String.fromCharCode(s))}return n.join("")},parse:function(t){for(var e=t.length,i=[],o=0;e>o;o++)i[o>>>1]|=r(t.charCodeAt(o)<<16-o%2*16);return n.create(i,2*e)}}}(),function(){if("function"==typeof ArrayBuffer){var r=t,e=r.lib,i=e.WordArray,n=i.init,o=i.init=function(t){if(t instanceof ArrayBuffer&&(t=new Uint8Array(t)),(t instanceof Int8Array||"undefined"!=typeof Uint8ClampedArray&&t instanceof Uint8ClampedArray||t instanceof Int16Array||t instanceof Uint16Array||t instanceof Int32Array||t instanceof Uint32Array||t instanceof Float32Array||t instanceof Float64Array)&&(t=new Uint8Array(t.buffer,t.byteOffset,t.byteLength)),t instanceof Uint8Array){for(var r=t.byteLength,e=[],i=0;r>i;i++)e[i>>>2]|=t[i]<<24-i%4*8;n.call(this,e,r)}else n.apply(this,arguments)};o.prototype=i}}(),function(){function r(t,r,e){return t^r^e}function e(t,r,e){return t&r|~t&e}function i(t,r,e){return(t|~r)^e}function n(t,r,e){return t&e|r&~e}function o(t,r,e){return t^(r|~e)}function s(t,r){return t<<r|t>>>32-r}var a=t,c=a.lib,h=c.WordArray,l=c.Hasher,f=a.algo,u=h.create([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13]),d=h.create([5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11]),v=h.create([11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6]),p=h.create([8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11]),_=h.create([0,1518500249,1859775393,2400959708,2840853838]),y=h.create([1352829926,1548603684,1836072691,2053994217,0]),g=f.RIPEMD160=l.extend({_doReset:function(){this._hash=h.create([1732584193,4023233417,2562383102,271733878,3285377520])},_doProcessBlock:function(t,a){for(var c=0;16>c;c++){var h=a+c,l=t[h];t[h]=16711935&(l<<8|l>>>24)|4278255360&(l<<24|l>>>8)}var f,g,B,k,w,S,m,x,b,H,z=this._hash.words,A=_.words,C=y.words,D=u.words,R=d.words,E=v.words,M=p.words;S=f=z[0],m=g=z[1],x=B=z[2],b=k=z[3],H=w=z[4];for(var F,c=0;80>c;c+=1)F=f+t[a+D[c]]|0,F+=16>c?r(g,B,k)+A[0]:32>c?e(g,B,k)+A[1]:48>c?i(g,B,k)+A[2]:64>c?n(g,B,k)+A[3]:o(g,B,k)+A[4],F=0|F,F=s(F,E[c]),F=F+w|0,f=w,w=k,k=s(B,10),B=g,g=F,F=S+t[a+R[c]]|0,F+=16>c?o(m,x,b)+C[0]:32>c?n(m,x,b)+C[1]:48>c?i(m,x,b)+C[2]:64>c?e(m,x,b)+C[3]:r(m,x,b)+C[4],F=0|F,F=s(F,M[c]),F=F+H|0,S=H,H=b,b=s(x,10),x=m,m=F;F=z[1]+B+b|0,z[1]=z[2]+k+H|0,z[2]=z[3]+w+S|0,z[3]=z[4]+f+m|0,z[4]=z[0]+g+x|0,z[0]=F},_doFinalize:function(){var t=this._data,r=t.words,e=8*this._nDataBytes,i=8*t.sigBytes;r[i>>>5]|=128<<24-i%32,r[(i+64>>>9<<4)+14]=16711935&(e<<8|e>>>24)|4278255360&(e<<24|e>>>8),t.sigBytes=4*(r.length+1),this._process();for(var n=this._hash,o=n.words,s=0;5>s;s++){var a=o[s];o[s]=16711935&(a<<8|a>>>24)|4278255360&(a<<24|a>>>8)}return n},clone:function(){var t=l.clone.call(this);return t._hash=this._hash.clone(),t}});a.RIPEMD160=l._createHelper(g),a.HmacRIPEMD160=l._createHmacHelper(g)}(Math),function(){{var r=t,e=r.lib,i=e.Base,n=r.enc,o=n.Utf8,s=r.algo;s.HMAC=i.extend({init:function(t,r){t=this._hasher=new t.init,"string"==typeof r&&(r=o.parse(r));var e=t.blockSize,i=4*e;r.sigBytes>i&&(r=t.finalize(r)),r.clamp();for(var n=this._oKey=r.clone(),s=this._iKey=r.clone(),a=n.words,c=s.words,h=0;e>h;h++)a[h]^=1549556828,c[h]^=909522486;n.sigBytes=s.sigBytes=i,this.reset()},reset:function(){var t=this._hasher;t.reset(),t.update(this._iKey)},update:function(t){return this._hasher.update(t),this},finalize:function(t){var r=this._hasher,e=r.finalize(t);r.reset();var i=r.finalize(this._oKey.clone().concat(e));return i}})}}(),function(){var r=t,e=r.lib,i=e.Base,n=e.WordArray,o=r.algo,s=o.SHA1,a=o.HMAC,c=o.PBKDF2=i.extend({cfg:i.extend({keySize:4,hasher:s,iterations:1}),init:function(t){this.cfg=this.cfg.extend(t)},compute:function(t,r){for(var e=this.cfg,i=a.create(e.hasher,t),o=n.create(),s=n.create([1]),c=o.words,h=s.words,l=e.keySize,f=e.iterations;c.length<l;){var u=i.update(r).finalize(s);i.reset();for(var d=u.words,v=d.length,p=u,_=1;f>_;_++){p=i.finalize(p),i.reset();for(var y=p.words,g=0;v>g;g++)d[g]^=y[g]}o.concat(u),h[0]++}return o.sigBytes=4*l,o}});r.PBKDF2=function(t,r,e){return c.create(e).compute(t,r)}}(),function(){var r=t,e=r.lib,i=e.Base,n=e.WordArray,o=r.algo,s=o.MD5,a=o.EvpKDF=i.extend({cfg:i.extend({keySize:4,hasher:s,iterations:1}),init:function(t){this.cfg=this.cfg.extend(t)},compute:function(t,r){for(var e=this.cfg,i=e.hasher.create(),o=n.create(),s=o.words,a=e.keySize,c=e.iterations;s.length<a;){h&&i.update(h);var h=i.update(t).finalize(r);i.reset();for(var l=1;c>l;l++)h=i.finalize(h),i.reset();o.concat(h)}return o.sigBytes=4*a,o}});r.EvpKDF=function(t,r,e){return a.create(e).compute(t,r)}}(),function(){var r=t,e=r.lib,i=e.WordArray,n=r.algo,o=n.SHA256,s=n.SHA224=o.extend({_doReset:function(){this._hash=new i.init([3238371032,914150663,812702999,4144912697,4290775857,1750603025,1694076839,3204075428])},_doFinalize:function(){var t=o._doFinalize.call(this);return t.sigBytes-=4,t}});r.SHA224=o._createHelper(s),r.HmacSHA224=o._createHmacHelper(s)}(),function(r){{var e=t,i=e.lib,n=i.Base,o=i.WordArray,s=e.x64={};s.Word=n.extend({init:function(t,r){this.high=t,this.low=r}}),s.WordArray=n.extend({init:function(t,e){t=this.words=t||[],this.sigBytes=e!=r?e:8*t.length},toX32:function(){for(var t=this.words,r=t.length,e=[],i=0;r>i;i++){var n=t[i];e.push(n.high),e.push(n.low)}return o.create(e,this.sigBytes)},clone:function(){for(var t=n.clone.call(this),r=t.words=this.words.slice(0),e=r.length,i=0;e>i;i++)r[i]=r[i].clone();return t}})}}(),function(r){var e=t,i=e.lib,n=i.WordArray,o=i.Hasher,s=e.x64,a=s.Word,c=e.algo,h=[],l=[],f=[];!function(){for(var t=1,r=0,e=0;24>e;e++){h[t+5*r]=(e+1)*(e+2)/2%64;var i=r%5,n=(2*t+3*r)%5;t=i,r=n}for(var t=0;5>t;t++)for(var r=0;5>r;r++)l[t+5*r]=r+(2*t+3*r)%5*5;for(var o=1,s=0;24>s;s++){for(var c=0,u=0,d=0;7>d;d++){if(1&o){var v=(1<<d)-1;32>v?u^=1<<v:c^=1<<v-32}128&o?o=o<<1^113:o<<=1}f[s]=a.create(c,u)}}();var u=[];!function(){for(var t=0;25>t;t++)u[t]=a.create()}();var d=c.SHA3=o.extend({cfg:o.cfg.extend({outputLength:512}),_doReset:function(){for(var t=this._state=[],r=0;25>r;r++)t[r]=new a.init;this.blockSize=(1600-2*this.cfg.outputLength)/32},_doProcessBlock:function(t,r){for(var e=this._state,i=this.blockSize/2,n=0;i>n;n++){var o=t[r+2*n],s=t[r+2*n+1];o=16711935&(o<<8|o>>>24)|4278255360&(o<<24|o>>>8),s=16711935&(s<<8|s>>>24)|4278255360&(s<<24|s>>>8);var a=e[n];a.high^=s,a.low^=o}for(var c=0;24>c;c++){for(var d=0;5>d;d++){for(var v=0,p=0,_=0;5>_;_++){var a=e[d+5*_];v^=a.high,p^=a.low}var y=u[d];y.high=v,y.low=p}for(var d=0;5>d;d++)for(var g=u[(d+4)%5],B=u[(d+1)%5],k=B.high,w=B.low,v=g.high^(k<<1|w>>>31),p=g.low^(w<<1|k>>>31),_=0;5>_;_++){var a=e[d+5*_];a.high^=v,a.low^=p}for(var S=1;25>S;S++){var a=e[S],m=a.high,x=a.low,b=h[S];if(32>b)var v=m<<b|x>>>32-b,p=x<<b|m>>>32-b;else var v=x<<b-32|m>>>64-b,p=m<<b-32|x>>>64-b;var H=u[l[S]];H.high=v,H.low=p}var z=u[0],A=e[0];z.high=A.high,z.low=A.low;for(var d=0;5>d;d++)for(var _=0;5>_;_++){var S=d+5*_,a=e[S],C=u[S],D=u[(d+1)%5+5*_],R=u[(d+2)%5+5*_];a.high=C.high^~D.high&R.high,a.low=C.low^~D.low&R.low}var a=e[0],E=f[c];a.high^=E.high,a.low^=E.low}},_doFinalize:function(){var t=this._data,e=t.words,i=(8*this._nDataBytes,8*t.sigBytes),o=32*this.blockSize;e[i>>>5]|=1<<24-i%32,e[(r.ceil((i+1)/o)*o>>>5)-1]|=128,t.sigBytes=4*e.length,this._process();for(var s=this._state,a=this.cfg.outputLength/8,c=a/8,h=[],l=0;c>l;l++){var f=s[l],u=f.high,d=f.low;u=16711935&(u<<8|u>>>24)|4278255360&(u<<24|u>>>8),d=16711935&(d<<8|d>>>24)|4278255360&(d<<24|d>>>8),h.push(d),h.push(u)}return new n.init(h,a)},clone:function(){for(var t=o.clone.call(this),r=t._state=this._state.slice(0),e=0;25>e;e++)r[e]=r[e].clone();return t}});e.SHA3=o._createHelper(d),e.HmacSHA3=o._createHmacHelper(d)}(Math),function(){function r(){return s.create.apply(s,arguments)}var e=t,i=e.lib,n=i.Hasher,o=e.x64,s=o.Word,a=o.WordArray,c=e.algo,h=[r(1116352408,3609767458),r(1899447441,602891725),r(3049323471,3964484399),r(3921009573,2173295548),r(961987163,4081628472),r(1508970993,3053834265),r(2453635748,2937671579),r(2870763221,3664609560),r(3624381080,2734883394),r(310598401,1164996542),r(607225278,1323610764),r(1426881987,3590304994),r(1925078388,4068182383),r(2162078206,991336113),r(2614888103,633803317),r(3248222580,3479774868),r(3835390401,2666613458),r(4022224774,944711139),r(264347078,2341262773),r(604807628,2007800933),r(770255983,1495990901),r(1249150122,1856431235),r(1555081692,3175218132),r(1996064986,2198950837),r(2554220882,3999719339),r(2821834349,766784016),r(2952996808,2566594879),r(3210313671,3203337956),r(3336571891,1034457026),r(3584528711,2466948901),r(113926993,3758326383),r(338241895,168717936),r(666307205,1188179964),r(773529912,1546045734),r(1294757372,1522805485),r(1396182291,2643833823),r(1695183700,2343527390),r(1986661051,1014477480),r(2177026350,1206759142),r(2456956037,344077627),r(2730485921,1290863460),r(2820302411,3158454273),r(3259730800,3505952657),r(3345764771,106217008),r(3516065817,3606008344),r(3600352804,1432725776),r(4094571909,1467031594),r(275423344,851169720),r(430227734,3100823752),r(506948616,1363258195),r(659060556,3750685593),r(883997877,3785050280),r(958139571,3318307427),r(1322822218,3812723403),r(1537002063,2003034995),r(1747873779,3602036899),r(1955562222,1575990012),r(2024104815,1125592928),r(2227730452,2716904306),r(2361852424,442776044),r(2428436474,593698344),r(2756734187,3733110249),r(3204031479,2999351573),r(3329325298,3815920427),r(3391569614,3928383900),r(3515267271,566280711),r(3940187606,3454069534),r(4118630271,4000239992),r(116418474,1914138554),r(174292421,2731055270),r(289380356,3203993006),r(460393269,320620315),r(685471733,587496836),r(852142971,1086792851),r(1017036298,365543100),r(1126000580,2618297676),r(1288033470,3409855158),r(1501505948,4234509866),r(1607167915,987167468),r(1816402316,1246189591)],l=[];!function(){for(var t=0;80>t;t++)l[t]=r()}();var f=c.SHA512=n.extend({_doReset:function(){this._hash=new a.init([new s.init(1779033703,4089235720),new s.init(3144134277,2227873595),new s.init(1013904242,4271175723),new s.init(2773480762,1595750129),new s.init(1359893119,2917565137),new s.init(2600822924,725511199),new s.init(528734635,4215389547),new s.init(1541459225,327033209)])},_doProcessBlock:function(t,r){for(var e=this._hash.words,i=e[0],n=e[1],o=e[2],s=e[3],a=e[4],c=e[5],f=e[6],u=e[7],d=i.high,v=i.low,p=n.high,_=n.low,y=o.high,g=o.low,B=s.high,k=s.low,w=a.high,S=a.low,m=c.high,x=c.low,b=f.high,H=f.low,z=u.high,A=u.low,C=d,D=v,R=p,E=_,M=y,F=g,P=B,W=k,O=w,U=S,I=m,K=x,X=b,L=H,j=z,N=A,T=0;80>T;T++){var Z=l[T];if(16>T)var q=Z.high=0|t[r+2*T],G=Z.low=0|t[r+2*T+1];else{var J=l[T-15],$=J.high,Q=J.low,V=($>>>1|Q<<31)^($>>>8|Q<<24)^$>>>7,Y=(Q>>>1|$<<31)^(Q>>>8|$<<24)^(Q>>>7|$<<25),tr=l[T-2],rr=tr.high,er=tr.low,ir=(rr>>>19|er<<13)^(rr<<3|er>>>29)^rr>>>6,nr=(er>>>19|rr<<13)^(er<<3|rr>>>29)^(er>>>6|rr<<26),or=l[T-7],sr=or.high,ar=or.low,cr=l[T-16],hr=cr.high,lr=cr.low,G=Y+ar,q=V+sr+(Y>>>0>G>>>0?1:0),G=G+nr,q=q+ir+(nr>>>0>G>>>0?1:0),G=G+lr,q=q+hr+(lr>>>0>G>>>0?1:0);Z.high=q,Z.low=G}var fr=O&I^~O&X,ur=U&K^~U&L,dr=C&R^C&M^R&M,vr=D&E^D&F^E&F,pr=(C>>>28|D<<4)^(C<<30|D>>>2)^(C<<25|D>>>7),_r=(D>>>28|C<<4)^(D<<30|C>>>2)^(D<<25|C>>>7),yr=(O>>>14|U<<18)^(O>>>18|U<<14)^(O<<23|U>>>9),gr=(U>>>14|O<<18)^(U>>>18|O<<14)^(U<<23|O>>>9),Br=h[T],kr=Br.high,wr=Br.low,Sr=N+gr,mr=j+yr+(N>>>0>Sr>>>0?1:0),Sr=Sr+ur,mr=mr+fr+(ur>>>0>Sr>>>0?1:0),Sr=Sr+wr,mr=mr+kr+(wr>>>0>Sr>>>0?1:0),Sr=Sr+G,mr=mr+q+(G>>>0>Sr>>>0?1:0),xr=_r+vr,br=pr+dr+(_r>>>0>xr>>>0?1:0);j=X,N=L,X=I,L=K,I=O,K=U,U=W+Sr|0,O=P+mr+(W>>>0>U>>>0?1:0)|0,P=M,W=F,M=R,F=E,R=C,E=D,D=Sr+xr|0,C=mr+br+(Sr>>>0>D>>>0?1:0)|0}v=i.low=v+D,i.high=d+C+(D>>>0>v>>>0?1:0),_=n.low=_+E,n.high=p+R+(E>>>0>_>>>0?1:0),g=o.low=g+F,o.high=y+M+(F>>>0>g>>>0?1:0),k=s.low=k+W,s.high=B+P+(W>>>0>k>>>0?1:0),S=a.low=S+U,a.high=w+O+(U>>>0>S>>>0?1:0),x=c.low=x+K,c.high=m+I+(K>>>0>x>>>0?1:0),H=f.low=H+L,f.high=b+X+(L>>>0>H>>>0?1:0),A=u.low=A+N,u.high=z+j+(N>>>0>A>>>0?1:0)},_doFinalize:function(){var t=this._data,r=t.words,e=8*this._nDataBytes,i=8*t.sigBytes;r[i>>>5]|=128<<24-i%32,r[(i+128>>>10<<5)+30]=Math.floor(e/4294967296),r[(i+128>>>10<<5)+31]=e,t.sigBytes=4*r.length,this._process();var n=this._hash.toX32();return n},clone:function(){var t=n.clone.call(this);return t._hash=this._hash.clone(),t},blockSize:32});e.SHA512=n._createHelper(f),e.HmacSHA512=n._createHmacHelper(f)}(),function(){var r=t,e=r.x64,i=e.Word,n=e.WordArray,o=r.algo,s=o.SHA512,a=o.SHA384=s.extend({_doReset:function(){this._hash=new n.init([new i.init(3418070365,3238371032),new i.init(1654270250,914150663),new i.init(2438529370,812702999),new i.init(355462360,4144912697),new i.init(1731405415,4290775857),new i.init(2394180231,1750603025),new i.init(3675008525,1694076839),new i.init(1203062813,3204075428)])},_doFinalize:function(){var t=s._doFinalize.call(this);return t.sigBytes-=16,t}});r.SHA384=s._createHelper(a),r.HmacSHA384=s._createHmacHelper(a)}(),t.lib.Cipher||function(r){var e=t,i=e.lib,n=i.Base,o=i.WordArray,s=i.BufferedBlockAlgorithm,a=e.enc,c=(a.Utf8,a.Base64),h=e.algo,l=h.EvpKDF,f=i.Cipher=s.extend({cfg:n.extend(),createEncryptor:function(t,r){return this.create(this._ENC_XFORM_MODE,t,r)},createDecryptor:function(t,r){return this.create(this._DEC_XFORM_MODE,t,r)},init:function(t,r,e){this.cfg=this.cfg.extend(e),this._xformMode=t,this._key=r,this.reset()},reset:function(){s.reset.call(this),this._doReset()},process:function(t){return this._append(t),this._process()},finalize:function(t){t&&this._append(t);var r=this._doFinalize();return r},keySize:4,ivSize:4,_ENC_XFORM_MODE:1,_DEC_XFORM_MODE:2,_createHelper:function(){function t(t){return"string"==typeof t?m:k}return function(r){return{encrypt:function(e,i,n){return t(i).encrypt(r,e,i,n)},decrypt:function(e,i,n){return t(i).decrypt(r,e,i,n)}}}}()}),u=(i.StreamCipher=f.extend({_doFinalize:function(){var t=this._process(!0);return t},blockSize:1}),e.mode={}),d=i.BlockCipherMode=n.extend({createEncryptor:function(t,r){return this.Encryptor.create(t,r)},createDecryptor:function(t,r){return this.Decryptor.create(t,r)},init:function(t,r){this._cipher=t,this._iv=r}}),v=u.CBC=function(){function t(t,e,i){var n=this._iv;if(n){var o=n;this._iv=r}else var o=this._prevBlock;for(var s=0;i>s;s++)t[e+s]^=o[s]}var e=d.extend();return e.Encryptor=e.extend({processBlock:function(r,e){var i=this._cipher,n=i.blockSize;t.call(this,r,e,n),i.encryptBlock(r,e),this._prevBlock=r.slice(e,e+n)}}),e.Decryptor=e.extend({processBlock:function(r,e){var i=this._cipher,n=i.blockSize,o=r.slice(e,e+n);i.decryptBlock(r,e),t.call(this,r,e,n),this._prevBlock=o}}),e}(),p=e.pad={},_=p.Pkcs7={pad:function(t,r){for(var e=4*r,i=e-t.sigBytes%e,n=i<<24|i<<16|i<<8|i,s=[],a=0;i>a;a+=4)s.push(n);var c=o.create(s,i);t.concat(c)},unpad:function(t){var r=255&t.words[t.sigBytes-1>>>2];t.sigBytes-=r}},y=(i.BlockCipher=f.extend({cfg:f.cfg.extend({mode:v,padding:_}),reset:function(){f.reset.call(this);var t=this.cfg,r=t.iv,e=t.mode;if(this._xformMode==this._ENC_XFORM_MODE)var i=e.createEncryptor;else{var i=e.createDecryptor;this._minBufferSize=1}this._mode=i.call(e,this,r&&r.words)},_doProcessBlock:function(t,r){this._mode.processBlock(t,r)},_doFinalize:function(){var t=this.cfg.padding;if(this._xformMode==this._ENC_XFORM_MODE){t.pad(this._data,this.blockSize);var r=this._process(!0)}else{var r=this._process(!0);t.unpad(r)}return r},blockSize:4}),i.CipherParams=n.extend({init:function(t){this.mixIn(t)},toString:function(t){return(t||this.formatter).stringify(this)}})),g=e.format={},B=g.OpenSSL={stringify:function(t){var r=t.ciphertext,e=t.salt;if(e)var i=o.create([1398893684,1701076831]).concat(e).concat(r);else var i=r;return i.toString(c)},parse:function(t){var r=c.parse(t),e=r.words;if(1398893684==e[0]&&1701076831==e[1]){var i=o.create(e.slice(2,4));e.splice(0,4),r.sigBytes-=16}return y.create({ciphertext:r,salt:i})}},k=i.SerializableCipher=n.extend({cfg:n.extend({format:B}),encrypt:function(t,r,e,i){i=this.cfg.extend(i);var n=t.createEncryptor(e,i),o=n.finalize(r),s=n.cfg;return y.create({ciphertext:o,key:e,iv:s.iv,algorithm:t,mode:s.mode,padding:s.padding,blockSize:t.blockSize,formatter:i.format})},decrypt:function(t,r,e,i){i=this.cfg.extend(i),r=this._parse(r,i.format);var n=t.createDecryptor(e,i).finalize(r.ciphertext);return n},_parse:function(t,r){return"string"==typeof t?r.parse(t,this):t}}),w=e.kdf={},S=w.OpenSSL={execute:function(t,r,e,i){i||(i=o.random(8));var n=l.create({keySize:r+e}).compute(t,i),s=o.create(n.words.slice(r),4*e);return n.sigBytes=4*r,y.create({key:n,iv:s,salt:i})}},m=i.PasswordBasedCipher=k.extend({cfg:k.cfg.extend({kdf:S}),encrypt:function(t,r,e,i){i=this.cfg.extend(i);var n=i.kdf.execute(e,t.keySize,t.ivSize);i.iv=n.iv;var o=k.encrypt.call(this,t,r,n.key,i);return o.mixIn(n),o},decrypt:function(t,r,e,i){i=this.cfg.extend(i),r=this._parse(r,i.format);var n=i.kdf.execute(e,t.keySize,t.ivSize,r.salt);i.iv=n.iv;var o=k.decrypt.call(this,t,r,n.key,i);return o}})}(),t.mode.CFB=function(){function r(t,r,e,i){var n=this._iv;if(n){var o=n.slice(0);this._iv=void 0}else var o=this._prevBlock;i.encryptBlock(o,0);for(var s=0;e>s;s++)t[r+s]^=o[s]}var e=t.lib.BlockCipherMode.extend();return e.Encryptor=e.extend({processBlock:function(t,e){var i=this._cipher,n=i.blockSize;r.call(this,t,e,n,i),this._prevBlock=t.slice(e,e+n)}}),e.Decryptor=e.extend({processBlock:function(t,e){var i=this._cipher,n=i.blockSize,o=t.slice(e,e+n);r.call(this,t,e,n,i),this._prevBlock=o}}),e}(),t.mode.ECB=function(){var r=t.lib.BlockCipherMode.extend();return r.Encryptor=r.extend({processBlock:function(t,r){this._cipher.encryptBlock(t,r)}}),r.Decryptor=r.extend({processBlock:function(t,r){this._cipher.decryptBlock(t,r)}}),r}(),t.pad.AnsiX923={pad:function(t,r){var e=t.sigBytes,i=4*r,n=i-e%i,o=e+n-1;t.clamp(),t.words[o>>>2]|=n<<24-o%4*8,t.sigBytes+=n},unpad:function(t){var r=255&t.words[t.sigBytes-1>>>2];t.sigBytes-=r}},t.pad.Iso10126={pad:function(r,e){var i=4*e,n=i-r.sigBytes%i;r.concat(t.lib.WordArray.random(n-1)).concat(t.lib.WordArray.create([n<<24],1))},unpad:function(t){var r=255&t.words[t.sigBytes-1>>>2];t.sigBytes-=r}},t.pad.Iso97971={pad:function(r,e){r.concat(t.lib.WordArray.create([2147483648],1)),t.pad.ZeroPadding.pad(r,e)},unpad:function(r){t.pad.ZeroPadding.unpad(r),r.sigBytes--}},t.mode.OFB=function(){var r=t.lib.BlockCipherMode.extend(),e=r.Encryptor=r.extend({processBlock:function(t,r){var e=this._cipher,i=e.blockSize,n=this._iv,o=this._keystream;n&&(o=this._keystream=n.slice(0),this._iv=void 0),e.encryptBlock(o,0);for(var s=0;i>s;s++)t[r+s]^=o[s]}});return r.Decryptor=e,r}(),t.pad.NoPadding={pad:function(){},unpad:function(){}},function(){{var r=t,e=r.lib,i=e.CipherParams,n=r.enc,o=n.Hex,s=r.format;s.Hex={stringify:function(t){return t.ciphertext.toString(o)},parse:function(t){var r=o.parse(t);return i.create({ciphertext:r})}}}}(),function(){var r=t,e=r.lib,i=e.BlockCipher,n=r.algo,o=[],s=[],a=[],c=[],h=[],l=[],f=[],u=[],d=[],v=[];!function(){for(var t=[],r=0;256>r;r++)t[r]=128>r?r<<1:r<<1^283;for(var e=0,i=0,r=0;256>r;r++){var n=i^i<<1^i<<2^i<<3^i<<4;n=n>>>8^255&n^99,o[e]=n,s[n]=e;var p=t[e],_=t[p],y=t[_],g=257*t[n]^16843008*n;a[e]=g<<24|g>>>8,c[e]=g<<16|g>>>16,h[e]=g<<8|g>>>24,l[e]=g;var g=16843009*y^65537*_^257*p^16843008*e;f[n]=g<<24|g>>>8,u[n]=g<<16|g>>>16,d[n]=g<<8|g>>>24,v[n]=g,e?(e=p^t[t[t[y^p]]],i^=t[t[i]]):e=i=1}}();var p=[0,1,2,4,8,16,32,64,128,27,54],_=n.AES=i.extend({_doReset:function(){if(!this._nRounds||this._keyPriorReset!==this._key){for(var t=this._keyPriorReset=this._key,r=t.words,e=t.sigBytes/4,i=this._nRounds=e+6,n=4*(i+1),s=this._keySchedule=[],a=0;n>a;a++)if(e>a)s[a]=r[a];else{var c=s[a-1];a%e?e>6&&a%e==4&&(c=o[c>>>24]<<24|o[c>>>16&255]<<16|o[c>>>8&255]<<8|o[255&c]):(c=c<<8|c>>>24,c=o[c>>>24]<<24|o[c>>>16&255]<<16|o[c>>>8&255]<<8|o[255&c],c^=p[a/e|0]<<24),s[a]=s[a-e]^c}for(var h=this._invKeySchedule=[],l=0;n>l;l++){var a=n-l;if(l%4)var c=s[a];else var c=s[a-4];h[l]=4>l||4>=a?c:f[o[c>>>24]]^u[o[c>>>16&255]]^d[o[c>>>8&255]]^v[o[255&c]]}}},encryptBlock:function(t,r){this._doCryptBlock(t,r,this._keySchedule,a,c,h,l,o)},decryptBlock:function(t,r){var e=t[r+1];t[r+1]=t[r+3],t[r+3]=e,this._doCryptBlock(t,r,this._invKeySchedule,f,u,d,v,s);var e=t[r+1];t[r+1]=t[r+3],t[r+3]=e},_doCryptBlock:function(t,r,e,i,n,o,s,a){for(var c=this._nRounds,h=t[r]^e[0],l=t[r+1]^e[1],f=t[r+2]^e[2],u=t[r+3]^e[3],d=4,v=1;c>v;v++){var p=i[h>>>24]^n[l>>>16&255]^o[f>>>8&255]^s[255&u]^e[d++],_=i[l>>>24]^n[f>>>16&255]^o[u>>>8&255]^s[255&h]^e[d++],y=i[f>>>24]^n[u>>>16&255]^o[h>>>8&255]^s[255&l]^e[d++],g=i[u>>>24]^n[h>>>16&255]^o[l>>>8&255]^s[255&f]^e[d++];h=p,l=_,f=y,u=g}var p=(a[h>>>24]<<24|a[l>>>16&255]<<16|a[f>>>8&255]<<8|a[255&u])^e[d++],_=(a[l>>>24]<<24|a[f>>>16&255]<<16|a[u>>>8&255]<<8|a[255&h])^e[d++],y=(a[f>>>24]<<24|a[u>>>16&255]<<16|a[h>>>8&255]<<8|a[255&l])^e[d++],g=(a[u>>>24]<<24|a[h>>>16&255]<<16|a[l>>>8&255]<<8|a[255&f])^e[d++];t[r]=p,t[r+1]=_,t[r+2]=y,t[r+3]=g},keySize:8});r.AES=i._createHelper(_)}(),function(){function r(t,r){var e=(this._lBlock>>>t^this._rBlock)&r;this._rBlock^=e,this._lBlock^=e<<t}function e(t,r){var e=(this._rBlock>>>t^this._lBlock)&r;this._lBlock^=e,this._rBlock^=e<<t}var i=t,n=i.lib,o=n.WordArray,s=n.BlockCipher,a=i.algo,c=[57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4],h=[14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32],l=[1,2,4,6,8,10,12,14,15,17,19,21,23,25,27,28],f=[{0:8421888,268435456:32768,536870912:8421378,805306368:2,1073741824:512,1342177280:8421890,1610612736:8389122,1879048192:8388608,2147483648:514,2415919104:8389120,2684354560:33280,2952790016:8421376,3221225472:32770,3489660928:8388610,3758096384:0,4026531840:33282,134217728:0,402653184:8421890,671088640:33282,939524096:32768,1207959552:8421888,1476395008:512,1744830464:8421378,2013265920:2,2281701376:8389120,2550136832:33280,2818572288:8421376,3087007744:8389122,3355443200:8388610,3623878656:32770,3892314112:514,4160749568:8388608,1:32768,268435457:2,536870913:8421888,805306369:8388608,1073741825:8421378,1342177281:33280,1610612737:512,1879048193:8389122,2147483649:8421890,2415919105:8421376,2684354561:8388610,2952790017:33282,3221225473:514,3489660929:8389120,3758096385:32770,4026531841:0,134217729:8421890,402653185:8421376,671088641:8388608,939524097:512,1207959553:32768,1476395009:8388610,1744830465:2,2013265921:33282,2281701377:32770,2550136833:8389122,2818572289:514,3087007745:8421888,3355443201:8389120,3623878657:0,3892314113:33280,4160749569:8421378},{0:1074282512,16777216:16384,33554432:524288,50331648:1074266128,67108864:1073741840,83886080:1074282496,100663296:1073758208,117440512:16,134217728:540672,150994944:1073758224,167772160:1073741824,184549376:540688,201326592:524304,218103808:0,234881024:16400,251658240:1074266112,8388608:1073758208,25165824:540688,41943040:16,58720256:1073758224,75497472:1074282512,92274688:1073741824,109051904:524288,125829120:1074266128,142606336:524304,159383552:0,176160768:16384,192937984:1074266112,209715200:1073741840,226492416:540672,243269632:1074282496,260046848:16400,268435456:0,285212672:1074266128,301989888:1073758224,318767104:1074282496,335544320:1074266112,352321536:16,369098752:540688,385875968:16384,402653184:16400,419430400:524288,436207616:524304,452984832:1073741840,469762048:540672,486539264:1073758208,503316480:1073741824,520093696:1074282512,276824064:540688,293601280:524288,310378496:1074266112,327155712:16384,343932928:1073758208,360710144:1074282512,377487360:16,394264576:1073741824,411041792:1074282496,427819008:1073741840,444596224:1073758224,461373440:524304,478150656:0,494927872:16400,511705088:1074266128,528482304:540672},{0:260,1048576:0,2097152:67109120,3145728:65796,4194304:65540,5242880:67108868,6291456:67174660,7340032:67174400,8388608:67108864,9437184:67174656,10485760:65792,11534336:67174404,12582912:67109124,13631488:65536,14680064:4,15728640:256,524288:67174656,1572864:67174404,2621440:0,3670016:67109120,4718592:67108868,5767168:65536,6815744:65540,7864320:260,8912896:4,9961472:256,11010048:67174400,12058624:65796,13107200:65792,14155776:67109124,15204352:67174660,16252928:67108864,16777216:67174656,17825792:65540,18874368:65536,19922944:67109120,20971520:256,22020096:67174660,23068672:67108868,24117248:0,25165824:67109124,26214400:67108864,27262976:4,28311552:65792,29360128:67174400,30408704:260,31457280:65796,32505856:67174404,17301504:67108864,18350080:260,19398656:67174656,20447232:0,21495808:65540,22544384:67109120,23592960:256,24641536:67174404,25690112:65536,26738688:67174660,27787264:65796,28835840:67108868,29884416:67109124,30932992:67174400,31981568:4,33030144:65792},{0:2151682048,65536:2147487808,131072:4198464,196608:2151677952,262144:0,327680:4198400,393216:2147483712,458752:4194368,524288:2147483648,589824:4194304,655360:64,720896:2147487744,786432:2151678016,851968:4160,917504:4096,983040:2151682112,32768:2147487808,98304:64,163840:2151678016,229376:2147487744,294912:4198400,360448:2151682112,425984:0,491520:2151677952,557056:4096,622592:2151682048,688128:4194304,753664:4160,819200:2147483648,884736:4194368,950272:4198464,1015808:2147483712,1048576:4194368,1114112:4198400,1179648:2147483712,1245184:0,1310720:4160,1376256:2151678016,1441792:2151682048,1507328:2147487808,1572864:2151682112,1638400:2147483648,1703936:2151677952,1769472:4198464,1835008:2147487744,1900544:4194304,1966080:64,2031616:4096,1081344:2151677952,1146880:2151682112,1212416:0,1277952:4198400,1343488:4194368,1409024:2147483648,1474560:2147487808,1540096:64,1605632:2147483712,1671168:4096,1736704:2147487744,1802240:2151678016,1867776:4160,1933312:2151682048,1998848:4194304,2064384:4198464},{0:128,4096:17039360,8192:262144,12288:536870912,16384:537133184,20480:16777344,24576:553648256,28672:262272,32768:16777216,36864:537133056,40960:536871040,45056:553910400,49152:553910272,53248:0,57344:17039488,61440:553648128,2048:17039488,6144:553648256,10240:128,14336:17039360,18432:262144,22528:537133184,26624:553910272,30720:536870912,34816:537133056,38912:0,43008:553910400,47104:16777344,51200:536871040,55296:553648128,59392:16777216,63488:262272,65536:262144,69632:128,73728:536870912,77824:553648256,81920:16777344,86016:553910272,90112:537133184,94208:16777216,98304:553910400,102400:553648128,106496:17039360,110592:537133056,114688:262272,118784:536871040,122880:0,126976:17039488,67584:553648256,71680:16777216,75776:17039360,79872:537133184,83968:536870912,88064:17039488,92160:128,96256:553910272,100352:262272,104448:553910400,108544:0,112640:553648128,116736:16777344,120832:262144,124928:537133056,129024:536871040},{0:268435464,256:8192,512:270532608,768:270540808,1024:268443648,1280:2097152,1536:2097160,1792:268435456,2048:0,2304:268443656,2560:2105344,2816:8,3072:270532616,3328:2105352,3584:8200,3840:270540800,128:270532608,384:270540808,640:8,896:2097152,1152:2105352,1408:268435464,1664:268443648,1920:8200,2176:2097160,2432:8192,2688:268443656,2944:270532616,3200:0,3456:270540800,3712:2105344,3968:268435456,4096:268443648,4352:270532616,4608:270540808,4864:8200,5120:2097152,5376:268435456,5632:268435464,5888:2105344,6144:2105352,6400:0,6656:8,6912:270532608,7168:8192,7424:268443656,7680:270540800,7936:2097160,4224:8,4480:2105344,4736:2097152,4992:268435464,5248:268443648,5504:8200,5760:270540808,6016:270532608,6272:270540800,6528:270532616,6784:8192,7040:2105352,7296:2097160,7552:0,7808:268435456,8064:268443656},{0:1048576,16:33555457,32:1024,48:1049601,64:34604033,80:0,96:1,112:34603009,128:33555456,144:1048577,160:33554433,176:34604032,192:34603008,208:1025,224:1049600,240:33554432,8:34603009,24:0,40:33555457,56:34604032,72:1048576,88:33554433,104:33554432,120:1025,136:1049601,152:33555456,168:34603008,184:1048577,200:1024,216:34604033,232:1,248:1049600,256:33554432,272:1048576,288:33555457,304:34603009,320:1048577,336:33555456,352:34604032,368:1049601,384:1025,400:34604033,416:1049600,432:1,448:0,464:34603008,480:33554433,496:1024,264:1049600,280:33555457,296:34603009,312:1,328:33554432,344:1048576,360:1025,376:34604032,392:33554433,408:34603008,424:0,440:34604033,456:1049601,472:1024,488:33555456,504:1048577},{0:134219808,1:131072,2:134217728,3:32,4:131104,5:134350880,6:134350848,7:2048,8:134348800,9:134219776,10:133120,11:134348832,12:2080,13:0,14:134217760,15:133152,2147483648:2048,2147483649:134350880,2147483650:134219808,2147483651:134217728,2147483652:134348800,2147483653:133120,2147483654:133152,2147483655:32,2147483656:134217760,2147483657:2080,2147483658:131104,2147483659:134350848,2147483660:0,2147483661:134348832,2147483662:134219776,2147483663:131072,16:133152,17:134350848,18:32,19:2048,20:134219776,21:134217760,22:134348832,23:131072,24:0,25:131104,26:134348800,27:134219808,28:134350880,29:133120,30:2080,31:134217728,2147483664:131072,2147483665:2048,2147483666:134348832,2147483667:133152,2147483668:32,2147483669:134348800,2147483670:134217728,2147483671:134219808,2147483672:134350880,2147483673:134217760,2147483674:134219776,2147483675:0,2147483676:133120,2147483677:2080,2147483678:131104,2147483679:134350848}],u=[4160749569,528482304,33030144,2064384,129024,8064,504,2147483679],d=a.DES=s.extend({_doReset:function(){for(var t=this._key,r=t.words,e=[],i=0;56>i;i++){var n=c[i]-1;
        e[i]=r[n>>>5]>>>31-n%32&1}for(var o=this._subKeys=[],s=0;16>s;s++){for(var a=o[s]=[],f=l[s],i=0;24>i;i++)a[i/6|0]|=e[(h[i]-1+f)%28]<<31-i%6,a[4+(i/6|0)]|=e[28+(h[i+24]-1+f)%28]<<31-i%6;a[0]=a[0]<<1|a[0]>>>31;for(var i=1;7>i;i++)a[i]=a[i]>>>4*(i-1)+3;a[7]=a[7]<<5|a[7]>>>27}for(var u=this._invSubKeys=[],i=0;16>i;i++)u[i]=o[15-i]},encryptBlock:function(t,r){this._doCryptBlock(t,r,this._subKeys)},decryptBlock:function(t,r){this._doCryptBlock(t,r,this._invSubKeys)},_doCryptBlock:function(t,i,n){this._lBlock=t[i],this._rBlock=t[i+1],r.call(this,4,252645135),r.call(this,16,65535),e.call(this,2,858993459),e.call(this,8,16711935),r.call(this,1,1431655765);for(var o=0;16>o;o++){for(var s=n[o],a=this._lBlock,c=this._rBlock,h=0,l=0;8>l;l++)h|=f[l][((c^s[l])&u[l])>>>0];this._lBlock=c,this._rBlock=a^h}var d=this._lBlock;this._lBlock=this._rBlock,this._rBlock=d,r.call(this,1,1431655765),e.call(this,8,16711935),e.call(this,2,858993459),r.call(this,16,65535),r.call(this,4,252645135),t[i]=this._lBlock,t[i+1]=this._rBlock},keySize:2,ivSize:2,blockSize:2});i.DES=s._createHelper(d);var v=a.TripleDES=s.extend({_doReset:function(){var t=this._key,r=t.words;this._des1=d.createEncryptor(o.create(r.slice(0,2))),this._des2=d.createEncryptor(o.create(r.slice(2,4))),this._des3=d.createEncryptor(o.create(r.slice(4,6)))},encryptBlock:function(t,r){this._des1.encryptBlock(t,r),this._des2.decryptBlock(t,r),this._des3.encryptBlock(t,r)},decryptBlock:function(t,r){this._des3.decryptBlock(t,r),this._des2.encryptBlock(t,r),this._des1.decryptBlock(t,r)},keySize:6,ivSize:2,blockSize:2});i.TripleDES=s._createHelper(v)}(),function(){function r(){for(var t=this._S,r=this._i,e=this._j,i=0,n=0;4>n;n++){r=(r+1)%256,e=(e+t[r])%256;var o=t[r];t[r]=t[e],t[e]=o,i|=t[(t[r]+t[e])%256]<<24-8*n}return this._i=r,this._j=e,i}var e=t,i=e.lib,n=i.StreamCipher,o=e.algo,s=o.RC4=n.extend({_doReset:function(){for(var t=this._key,r=t.words,e=t.sigBytes,i=this._S=[],n=0;256>n;n++)i[n]=n;for(var n=0,o=0;256>n;n++){var s=n%e,a=r[s>>>2]>>>24-s%4*8&255;o=(o+i[n]+a)%256;var c=i[n];i[n]=i[o],i[o]=c}this._i=this._j=0},_doProcessBlock:function(t,e){t[e]^=r.call(this)},keySize:8,ivSize:0});e.RC4=n._createHelper(s);var a=o.RC4Drop=s.extend({cfg:s.cfg.extend({drop:192}),_doReset:function(){s._doReset.call(this);for(var t=this.cfg.drop;t>0;t--)r.call(this)}});e.RC4Drop=n._createHelper(a)}(),t.mode.CTRGladman=function(){function r(t){if(255===(t>>24&255)){var r=t>>16&255,e=t>>8&255,i=255&t;255===r?(r=0,255===e?(e=0,255===i?i=0:++i):++e):++r,t=0,t+=r<<16,t+=e<<8,t+=i}else t+=1<<24;return t}function e(t){return 0===(t[0]=r(t[0]))&&(t[1]=r(t[1])),t}var i=t.lib.BlockCipherMode.extend(),n=i.Encryptor=i.extend({processBlock:function(t,r){var i=this._cipher,n=i.blockSize,o=this._iv,s=this._counter;o&&(s=this._counter=o.slice(0),this._iv=void 0),e(s);var a=s.slice(0);i.encryptBlock(a,0);for(var c=0;n>c;c++)t[r+c]^=a[c]}});return i.Decryptor=n,i}(),function(){function r(){for(var t=this._X,r=this._C,e=0;8>e;e++)a[e]=r[e];r[0]=r[0]+1295307597+this._b|0,r[1]=r[1]+3545052371+(r[0]>>>0<a[0]>>>0?1:0)|0,r[2]=r[2]+886263092+(r[1]>>>0<a[1]>>>0?1:0)|0,r[3]=r[3]+1295307597+(r[2]>>>0<a[2]>>>0?1:0)|0,r[4]=r[4]+3545052371+(r[3]>>>0<a[3]>>>0?1:0)|0,r[5]=r[5]+886263092+(r[4]>>>0<a[4]>>>0?1:0)|0,r[6]=r[6]+1295307597+(r[5]>>>0<a[5]>>>0?1:0)|0,r[7]=r[7]+3545052371+(r[6]>>>0<a[6]>>>0?1:0)|0,this._b=r[7]>>>0<a[7]>>>0?1:0;for(var e=0;8>e;e++){var i=t[e]+r[e],n=65535&i,o=i>>>16,s=((n*n>>>17)+n*o>>>15)+o*o,h=((4294901760&i)*i|0)+((65535&i)*i|0);c[e]=s^h}t[0]=c[0]+(c[7]<<16|c[7]>>>16)+(c[6]<<16|c[6]>>>16)|0,t[1]=c[1]+(c[0]<<8|c[0]>>>24)+c[7]|0,t[2]=c[2]+(c[1]<<16|c[1]>>>16)+(c[0]<<16|c[0]>>>16)|0,t[3]=c[3]+(c[2]<<8|c[2]>>>24)+c[1]|0,t[4]=c[4]+(c[3]<<16|c[3]>>>16)+(c[2]<<16|c[2]>>>16)|0,t[5]=c[5]+(c[4]<<8|c[4]>>>24)+c[3]|0,t[6]=c[6]+(c[5]<<16|c[5]>>>16)+(c[4]<<16|c[4]>>>16)|0,t[7]=c[7]+(c[6]<<8|c[6]>>>24)+c[5]|0}var e=t,i=e.lib,n=i.StreamCipher,o=e.algo,s=[],a=[],c=[],h=o.Rabbit=n.extend({_doReset:function(){for(var t=this._key.words,e=this.cfg.iv,i=0;4>i;i++)t[i]=16711935&(t[i]<<8|t[i]>>>24)|4278255360&(t[i]<<24|t[i]>>>8);var n=this._X=[t[0],t[3]<<16|t[2]>>>16,t[1],t[0]<<16|t[3]>>>16,t[2],t[1]<<16|t[0]>>>16,t[3],t[2]<<16|t[1]>>>16],o=this._C=[t[2]<<16|t[2]>>>16,4294901760&t[0]|65535&t[1],t[3]<<16|t[3]>>>16,4294901760&t[1]|65535&t[2],t[0]<<16|t[0]>>>16,4294901760&t[2]|65535&t[3],t[1]<<16|t[1]>>>16,4294901760&t[3]|65535&t[0]];this._b=0;for(var i=0;4>i;i++)r.call(this);for(var i=0;8>i;i++)o[i]^=n[i+4&7];if(e){var s=e.words,a=s[0],c=s[1],h=16711935&(a<<8|a>>>24)|4278255360&(a<<24|a>>>8),l=16711935&(c<<8|c>>>24)|4278255360&(c<<24|c>>>8),f=h>>>16|4294901760&l,u=l<<16|65535&h;o[0]^=h,o[1]^=f,o[2]^=l,o[3]^=u,o[4]^=h,o[5]^=f,o[6]^=l,o[7]^=u;for(var i=0;4>i;i++)r.call(this)}},_doProcessBlock:function(t,e){var i=this._X;r.call(this),s[0]=i[0]^i[5]>>>16^i[3]<<16,s[1]=i[2]^i[7]>>>16^i[5]<<16,s[2]=i[4]^i[1]>>>16^i[7]<<16,s[3]=i[6]^i[3]>>>16^i[1]<<16;for(var n=0;4>n;n++)s[n]=16711935&(s[n]<<8|s[n]>>>24)|4278255360&(s[n]<<24|s[n]>>>8),t[e+n]^=s[n]},blockSize:4,ivSize:2});e.Rabbit=n._createHelper(h)}(),t.mode.CTR=function(){var r=t.lib.BlockCipherMode.extend(),e=r.Encryptor=r.extend({processBlock:function(t,r){var e=this._cipher,i=e.blockSize,n=this._iv,o=this._counter;n&&(o=this._counter=n.slice(0),this._iv=void 0);var s=o.slice(0);e.encryptBlock(s,0),o[i-1]=o[i-1]+1|0;for(var a=0;i>a;a++)t[r+a]^=s[a]}});return r.Decryptor=e,r}(),function(){function r(){for(var t=this._X,r=this._C,e=0;8>e;e++)a[e]=r[e];r[0]=r[0]+1295307597+this._b|0,r[1]=r[1]+3545052371+(r[0]>>>0<a[0]>>>0?1:0)|0,r[2]=r[2]+886263092+(r[1]>>>0<a[1]>>>0?1:0)|0,r[3]=r[3]+1295307597+(r[2]>>>0<a[2]>>>0?1:0)|0,r[4]=r[4]+3545052371+(r[3]>>>0<a[3]>>>0?1:0)|0,r[5]=r[5]+886263092+(r[4]>>>0<a[4]>>>0?1:0)|0,r[6]=r[6]+1295307597+(r[5]>>>0<a[5]>>>0?1:0)|0,r[7]=r[7]+3545052371+(r[6]>>>0<a[6]>>>0?1:0)|0,this._b=r[7]>>>0<a[7]>>>0?1:0;for(var e=0;8>e;e++){var i=t[e]+r[e],n=65535&i,o=i>>>16,s=((n*n>>>17)+n*o>>>15)+o*o,h=((4294901760&i)*i|0)+((65535&i)*i|0);c[e]=s^h}t[0]=c[0]+(c[7]<<16|c[7]>>>16)+(c[6]<<16|c[6]>>>16)|0,t[1]=c[1]+(c[0]<<8|c[0]>>>24)+c[7]|0,t[2]=c[2]+(c[1]<<16|c[1]>>>16)+(c[0]<<16|c[0]>>>16)|0,t[3]=c[3]+(c[2]<<8|c[2]>>>24)+c[1]|0,t[4]=c[4]+(c[3]<<16|c[3]>>>16)+(c[2]<<16|c[2]>>>16)|0,t[5]=c[5]+(c[4]<<8|c[4]>>>24)+c[3]|0,t[6]=c[6]+(c[5]<<16|c[5]>>>16)+(c[4]<<16|c[4]>>>16)|0,t[7]=c[7]+(c[6]<<8|c[6]>>>24)+c[5]|0}var e=t,i=e.lib,n=i.StreamCipher,o=e.algo,s=[],a=[],c=[],h=o.RabbitLegacy=n.extend({_doReset:function(){var t=this._key.words,e=this.cfg.iv,i=this._X=[t[0],t[3]<<16|t[2]>>>16,t[1],t[0]<<16|t[3]>>>16,t[2],t[1]<<16|t[0]>>>16,t[3],t[2]<<16|t[1]>>>16],n=this._C=[t[2]<<16|t[2]>>>16,4294901760&t[0]|65535&t[1],t[3]<<16|t[3]>>>16,4294901760&t[1]|65535&t[2],t[0]<<16|t[0]>>>16,4294901760&t[2]|65535&t[3],t[1]<<16|t[1]>>>16,4294901760&t[3]|65535&t[0]];this._b=0;for(var o=0;4>o;o++)r.call(this);for(var o=0;8>o;o++)n[o]^=i[o+4&7];if(e){var s=e.words,a=s[0],c=s[1],h=16711935&(a<<8|a>>>24)|4278255360&(a<<24|a>>>8),l=16711935&(c<<8|c>>>24)|4278255360&(c<<24|c>>>8),f=h>>>16|4294901760&l,u=l<<16|65535&h;n[0]^=h,n[1]^=f,n[2]^=l,n[3]^=u,n[4]^=h,n[5]^=f,n[6]^=l,n[7]^=u;for(var o=0;4>o;o++)r.call(this)}},_doProcessBlock:function(t,e){var i=this._X;r.call(this),s[0]=i[0]^i[5]>>>16^i[3]<<16,s[1]=i[2]^i[7]>>>16^i[5]<<16,s[2]=i[4]^i[1]>>>16^i[7]<<16,s[3]=i[6]^i[3]>>>16^i[1]<<16;for(var n=0;4>n;n++)s[n]=16711935&(s[n]<<8|s[n]>>>24)|4278255360&(s[n]<<24|s[n]>>>8),t[e+n]^=s[n]},blockSize:4,ivSize:2});e.RabbitLegacy=n._createHelper(h)}(),t.pad.ZeroPadding={pad:function(t,r){var e=4*r;t.clamp(),t.sigBytes+=e-(t.sigBytes%e||e)},unpad:function(t){for(var r=t.words,e=t.sigBytes-1;!(r[e>>>2]>>>24-e%4*8&255);)e--;t.sigBytes=e+1}},t});
;/**
Copyright (c) 2012, Benjamin Dumke-von der Ehe

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
*/

/*
 LockableStorage.lock(key, lockAquiredCallback)
*/
(function () {

    function now() {
        return new Date().getTime();
    }
    
    function someNumber() {
        return Math.random() * 1000000000 | 0;
    }

    var myId = now() + ":" + someNumber();
        
    function getter(lskey) {
        return function () {
            var value = localStorage[lskey];
            if (!value)
                return null;
            
            var splitted = value.split(/\|/);
            if (parseInt(splitted[1]) < now()) {
                return null;
            }
            return splitted[0];
        }
    }
    
    function _mutexTransaction(key, callback, synchronous) {
        var xKey = key + "__MUTEX_x",
            yKey = key + "__MUTEX_y",
            getY = getter(yKey);

        function criticalSection() {
            try {
                callback();
            } finally {
                localStorage.removeItem(yKey);
            }
        }
        
        localStorage[xKey] = myId;
        if (getY()) {
            if (!synchronous)
                setTimeout(function () { _mutexTransaction(key, callback); }, 0);
            return false;
        }
        localStorage[yKey] = myId + "|" + (now() + 40);
        
        if (localStorage[xKey] !== myId) {
            if (!synchronous) {
                setTimeout(function () {
                    if (getY() !== myId) {
                        setTimeout(function () { _mutexTransaction(key, callback); }, 0);
                    } else {
                        criticalSection();
                    }
                }, 50)
            }
            return false;
        } else {
            criticalSection();
            return true;
        }
    }
    
    function lockImpl(key, callback, maxDuration, synchronous) {

        maxDuration = maxDuration || 5000;
        
        var mutexKey = key + "__MUTEX",
            getMutex = getter(mutexKey),
            mutexValue = myId + ":" + someNumber() + "|" + (now() + maxDuration);
            
        function restart () {
            setTimeout(function () { lockImpl(key, callback, maxDuration); }, 10);
        }
        
        if (getMutex()) {
            if (!synchronous)
                restart();
            return false;
        }
        
        var aquiredSynchronously = _mutexTransaction(key, function () {
            if (getMutex()) {
                if (!synchronous)
                    restart();
                return false;
            }
            localStorage[mutexKey] = mutexValue;
            if (!synchronous)
                setTimeout(mutexAquired, 0)
        }, synchronous);
        
        if (synchronous && aquiredSynchronously) {
            mutexAquired();
            return true;
        }
        return false;
        function mutexAquired() {
            try {
                callback();
            } finally {
                _mutexTransaction(key, function () {
                    if (localStorage[mutexKey] !== mutexValue)
                        throw key + " was locked by a different process while I held the lock"
                
                    localStorage.removeItem(mutexKey);
                });
            }
        }
        
    }
    
    window.LockableStorage = {
        lock: function (key, callback, maxDuration) { lockImpl(key, callback, maxDuration, false) },
        trySyncLock: function (key, callback, maxDuration) { return lockImpl(key, callback, maxDuration, true) }
    };
})();
