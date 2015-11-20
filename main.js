//headerData contains all the information about the first row of the CSV
var headerData, errors;

//now is the creationdata of the OAI respository
var now = new Date();
now = now.format('isoDate');

//the xml file header contains identify information.
var IdentifyInfo = {
    repositoryName:'Demo',
    baseURL:'http://demo.nl',
    protocolVersion:'2.0',
    adminEmail:'demo@oai.org',
    earliestDatestamp: now,
    deletedRecord:'no',
    granularity:'YYYY-MM-DD'
};


var textblob = "";

var itemDateGranularity;

$(function(){

    $( "#csvform" ).submit(function( event ) {

        event.preventDefault();
        $('#submitbutton').button('loading');

        //override the adjustable IdentifyInfo fields
        if( $('#respname').val() )
            IdentifyInfo.repositoryName = $('#respname').val();
        if( $('#adminEmail').val() )
            IdentifyInfo.adminEmail = $('#adminEmail').val();
        if( $('#baseURL').val() )
            IdentifyInfo.baseURL = $('#baseURL').val();

        itemDateGranularity = $( "#granularity").val();

        //the parser blocks DOM updates, so give dom some  
        //time to update.
        setTimeout(function(){
            readFileandAppend();
        }, 100);

    });

});


//create the static repository header.
function createXMLHeader(){
    var string = "";
    var headerstart = [
    '<?xml version="1.0" encoding="UTF-8"?> ',
    '<Repository xmlns="http://www.openarchives.org/OAI/2.0/static-repository"  ',
    '            xmlns:oai="http://www.openarchives.org/OAI/2.0/" ',
    '            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ',
    '            xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/static-repository ',
    '                                http://www.openarchives.org/OAI/2.0/static-repository.xsd">',
    '   <Identify>'];

    string = addToBlob(string, headerstart);

    _.each(IdentifyInfo, function (value, prop) {
        string += '   <oai:'+prop+'>'+value+'</oai:'+prop+'>\n';
    });

    var headerend = [
    '   </Identify>',
    '   <ListMetadataFormats>',
    '     <oai:metadataFormat>',
    '       <oai:metadataPrefix>oai_dc</oai:metadataPrefix>',
    '       <oai:schema>http://www.openarchives.org/OAI/2.0/oai_dc.xsd</oai:schema>',
    '       <oai:metadataNamespace>http://www.openarchives.org/OAI/2.0/oai_dc/',
    '           </oai:metadataNamespace>',
    '     </oai:metadataFormat>',
    '   </ListMetadataFormats>',
    '   <ListRecords metadataPrefix="oai_dc">'];

    string = addToBlob(string, headerend);

    return string;
}

//read the CSV file and append to the textblob
function readFileandAppend(listElem){
    var abort = false;
    var failedRows = [];
    var numOfCols;
    var filename = $('#inputcsv').val();
    var extention = filename.split(".").pop();
    var parseconfig = {
        before: function(file, inputElem)
        {
            var size = file.size;
            var percent = 0;
            var countRow = 0;
            errors = [];
            
            Papa.parse(file, {
                //using step the parser is able to parse bigger files.
                step: function(row, parser) {
                     // console.log(row, countRow);
                     // console.log("Row errors:",row.errors );

                     if(row.errors){
                        _.each(row.errors, function(error){
                            failedRows.push({num:countRow + 1, reason:error.message});
                        });
                        
                     }

                     if(countRow === 0){
                        
                        //check the header
                        var headerOk = checkHeader(row.data[0]);
                        if (!headerOk){
                            parser.abort();
                        }
                        numOfCols = row.data[0].length;
                      }

                      if(countRow > 0){

                           numOfColsInRow = row.data[0].length
                           if(numOfColsInRow < 2){
                                failedRows.push({num:countRow + 1, reason:'empty row', mesType: 'error'});
                           }
                           else if(numOfCols != numOfColsInRow){
                                //rows need to be the same length
                                failedRows.push({num:countRow + 1, reason:'incorrect number of colums ('+row.data[0].length+'/'+numOfCols+')', mesType: 'error'});
                           }
                           else{
                                rowstatus = addRecord(row.data[0]);
                               if(rowstatus.mesType == 'error'){
                                    failedRows.push({num:countRow + 1, reason:rowstatus.message, mesType: rowstatus.mesType});
                               }
                               
                               if(rowstatus.mesType == 'warning'){
                                   for (var i = 0; i < rowstatus.warnings.length; i++) {
                                       failedRows.push({num:countRow + 1, reason:rowstatus.warnings[i], mesType: rowstatus.mesType});
                                   };
                               }
                            }    
                      }
                      countRow++;
                }
            });
        },
        error: function(err, file, inputElem, reason)
        {
            console.log(err, inputElem, reason);
            // executed if an error occurs while loading the file,
            // or if before callback aborted for some reason
        },
        
        complete: function()
        {
            if(errors.length === 0){
                finishAndSaveFile(failedRows);
                $('#submitbutton').button('reset');
            }else {
                $('#submitbutton').button('reset');
                showErrors(errors);
            }
        }
    }

    if(extention == 'csv'){
        Papa.parse(parseconfig);
    }



}



//check if the headerRow of the CSV conforms to OAI
var checkHeader = function(headerrow){
    //the allowed fields of Dubln, core.
    var allowedfieldsDC = [
        'title','creator','subject','description',
        'contribitor','publisher','date','type','format','identifier',
        'source','language','relation','coverage','rights'
    ];
    

    headerData = {
        firstrow: headerrow,
        fields: []
    };

    headerData.firstrow = headerrow;
    if(headerrow[0] != 'UniqueIdentifier')
        errors.push( 'first CSV colum must be UniqueIdentifier');


    for (var i = 1, j = headerrow.length; i < j; i++) {
        var headerfield = headerrow[i];

        if(_.contains(allowedfieldsDC, headerfield)){
            headerData.fields.push(i);
        } else {
            errors.push(headerfield + ' is not part of Dublin Core');
        }
    }

    if(errors.length === 0)
        return true;
    else
        return false;
};


function addToBlob(blob, textarray){
    for (var i = 0, j = textarray.length; i < j; i++) {
        blob += textarray[i] + '\n';
    }
    return blob;
}


//add one Item to the blob
function addRecord(row){
    var warnings = [];
    
    //check for identifier and fail if not present.
    var id = row[0];
    if(id.length < 1)   {
        return {
            mesType:'error',
            message: "no UniqueIdentifier"
        }
    }
    var tempBlob = "";

    var xml = [
        '<oai:record> ' ,
        ' <oai:header> ',
        '  <oai:identifier>'+row[0]+'</oai:identifier>',
        '  <oai:datestamp>'+now+'</oai:datestamp>',
        ' </oai:header>' ,
        ' <oai:metadata>' ,
        '  <oai_dc:dc' ,
        '   xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" ' ,
        '   xmlns:dc="http://purl.org/dc/elements/1.1/" ' ,
        '   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' ,
        '   xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ ' ,
        '   http://www.openarchives.org/OAI/2.0/oai_dc.xsd"> '
    ];

    tempBlob = addToBlob(tempBlob, xml);

    //for every headerfield check if it exits and append to blob.
    for (var i = 0, j = headerData.fields.length; i < j; i++) {
        var colNum = headerData.fields[i];
        var prop = headerData.firstrow[colNum];
        var value = row[colNum];
        if(prop == 'date' && !checkDateFormatting(value))
            warnings.push('invalid date string "'+value+'"');

        if(value && value.length > 0)
            tempBlob += '   <dc:'+prop+'>'+value+'</dc:'+prop+'>\n';
    }

    var xmlend = [
        '  </oai_dc:dc> ' ,
        '  </oai:metadata> ' ,
        '   </oai:record>' ];
    
    tempBlob = addToBlob(tempBlob, xmlend);

    //only add the tempblob to the textblob if there are no errors.
    textblob += tempBlob;
    if(warnings.length > 0){
        return {
            mesType:'warning',
            warnings:warnings
        }
    }
    else {
        return {
            mesType:'succes',
        }
    }
}

checkDateFormatting = function(datestring){
    var date = new Date(datestring);
    console.log(datestring, date.getYear());
    if ( isNaN( date.getYear() ) )
        return false;
    else
        return true;
}

//bundle everything and save xml
finishAndSaveFile = function (failedrows) {
  
   var failed = failedrows.length;
   var header = createXMLHeader();
   var failedrowstring = "";

   //remove previous results
   $('#failedtable tr:not(:first)').remove();
   _.each(failedrows, function(row){
        var label = "";

        if(row.mesType == 'warning')
            label = '<span class="label label-warning">Warning</span>';
        else if(row.mesType == 'error')
            label = '<span class="label label-danger">Error</span>';

        $('#failedtable').append('<tr><td>'+row.num+'</td><td>'+label+'</td><td>'+row.reason+'</td><tr>');
   });
   
   textblob = header + textblob;
   
   textblob += '  </ListRecords>\n' +
                '</Repository>';

   var blob = new Blob([textblob], {type: "text/plain;charset=utf-8"});

    $('#resultpanel').show();
    if(failed > 0){
        $('#failednum').html(failed);
        $('#failedrows').html(failedrowstring);
        $('.failed').show();
        $('.succes').hide();
    } else {
        $('.failed').hide();
        $('.succes').show();
    }

    $('#downloadbutton').click( function(){
        console.log('trying to save file');
        console.log(textblob);
        saveAs(blob, IdentifyInfo['repositoryName'] +".xml");
    });
};


showErrors = function(){
    $('#errorpanel').show();
    $('#resultpanel').hide();

    _.each(errors, function(error){
        $('#errorlist').append(
            '<li>'+error+'</li>'
            );
    });
};


//experimental

function handleFile(e) {
  var files = e.target.files;
  var i,f;
  for (i = 0, f = files[i]; i != files.length; ++i) {
    var reader = new FileReader();
    var name = f.name;
    reader.onload = function(e) {
      var data = e.target.result;

      var workbook = XLSX.read(data, {type: 'binary'});

      var sheetNameList = workbook.SheetNames;
      var worksheet = workbook.Sheets[sheetNameList[0]];
      console.log(sheetNameList);

      csvString = XLSX.utils.sheet_to_csv(worksheet);

      Papa.parse(csvString);

      /* DO SOMETHING WITH workbook HERE */
    };
    reader.readAsBinaryString(f);
  }
}
document.getElementById('inputexcel').addEventListener('change', handleFile, false);
