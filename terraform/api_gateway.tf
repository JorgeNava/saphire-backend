locals {
  lambda_routes = {
    saveTextMessage  = { method = "POST", path = "/messages/text" }
    saveAudioMessage = { method = "POST", path = "/messages/audio" }
    generateUploadUrl= { method = "GET" , path = "/messages/upload-url" }
    getMessages      = { method = "GET" , path = "/messages" }
    getMessage       = { method = "GET" , path = "/messages/{conversationId}/{timestamp}" }
    updateMessage    = { method = "PUT" , path = "/messages/{conversationId}/{timestamp}" }
    deleteMessage    = { method = "DELETE", path = "/messages/{conversationId}/{timestamp}" }
    createList       = { method = "POST", path = "/lists" }
    getLists         = { method = "GET" , path = "/lists" }
    addItemToList    = { method = "POST", path = "/lists/{listId}/items" }
    deleteListItem   = { method = "DELETE", path = "/lists/{listId}/items/{itemId}" }
    replaceListItems = { method = "PUT" , path = "/lists/{listId}/items" }
    deleteList       = { method = "DELETE", path = "/lists/{listId}" }
    createThought    = { method = "POST", path = "/thoughts" }
    getThoughts      = { method = "GET" , path = "/thoughts" }
    getThought       = { method = "GET" , path = "/thoughts/{thoughtId}" }
    updateThought    = { method = "PUT" , path = "/thoughts/{thoughtId}" }
    deleteThought    = { method = "DELETE", path = "/thoughts/{thoughtId}" }
    createNote       = { method = "POST", path = "/notes" }
    getNotes         = { method = "GET" , path = "/notes" }
    getNote          = { method = "GET" , path = "/notes/{noteId}" }
    updateNote       = { method = "PUT" , path = "/notes/{noteId}" }
    deleteNote       = { method = "DELETE", path = "/notes/{noteId}" }
    createTag        = { method = "POST", path = "/tags" }
    getTags          = { method = "GET" , path = "/tags" }
    getTag           = { method = "GET" , path = "/tags/{tagId}" }
    updateTag        = { method = "PUT" , path = "/tags/{tagId}" }
    deleteTag        = { method = "DELETE", path = "/tags/{tagId}" }
    recordAction     = { method = "POST", path = "/actions" }
    getActions       = { method = "GET" , path = "/actions" }
    createUser       = { method = "POST", path = "/users" }
    getUser          = { method = "GET" , path = "/users/{userId}" }
    updateUser       = { method = "PUT" , path = "/users/{userId}" }
  }
}
