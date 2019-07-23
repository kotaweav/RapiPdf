/* Generates an schema object containing type and constraint info */
let rowLinesOnlyTableLayout= {
  hLineWidth: function (i, node) {
    //return (i === 0 || i === 1 || i === node.table.body.length) ? 0 : 0.5;
    return 0;
  },
  vLineWidth:function(i,node){
    return 0;
  },
  /*
  hLineColor: function (i, node) {
    return (i === 0 || i === node.table.body.length) ? 'black' : 'lightgray';
  },
  */
  paddingTop: function(i, node) { return 0; },
	paddingBottom: function(i, node) { return 0; },
};

export function getTypeInfo(schema, overrideAttributes=null){
  if (!schema){
    return;
  }
  let returnObj = {
    hasCircularRefs:schema.type==="circular",
    format    : schema.format?schema.format:'',
    pattern   : (schema.pattern && !schema.enum) ? schema.pattern:'',
    readOnly  : schema.readOnly ? 'read-only' : '',
    writeOnly : schema.writeOnly ? 'write-only' : '',
    depricated: schema.deprecated ? 'depricated' : '',
    default   : schema.default==0 ? '0 ': (schema.default ? schema.default : ''),
    type      : '',
    arrayType : '',
    allowedValues:'',
    constrain : '',
    html      : ''
  };
  if (returnObj.hasCircularRefs){
    return returnObj;
  }
  // Set the Type
  if (schema.enum) {
    let opt=""
    schema.enum.map(function(v){
      opt = opt + `${v}, `
    });
    returnObj.type='enum';
    returnObj.allowedValues = opt.slice(0,-2);
    console.log(schema.enum);
  }
  else if (schema.type) {
    returnObj.type = schema.type;
  }
  
  if (schema.type==="array" && schema.items){
    let arraySchema = schema.items;
    returnObj.arrayType = `${schema.type} of ${arraySchema.type}`;
    returnObj.default = arraySchema.default==0 ? '0 ': (arraySchema.default ? arraySchema.default : '');
    if (arraySchema.enum){
      let opt=""
      arraySchema.enum.map(function(v){
        opt = opt + `${v}, `
      });
      returnObj.allowedValues = opt.slice(0,-2);
    }
  }
  else if (schema.type==="integer" || schema.type==="number"){
    if (schema.minimum !== undefined && schema.maximum!==undefined){
      returnObj.constrain = `${schema.exclusiveMinimum?">":"between "}${schema.minimum} and ${schema.exclusiveMaximum?"<":""} ${schema.maximum}`
    }
    else if (schema.minimum!==undefined && schema.maximum===undefined){
      returnObj.constrain = `${schema.exclusiveMinimum?">":">="}${schema.minimum}`
    }
    else if (schema.minimum===undefined && schema.maximum!==undefined){
      returnObj.constrain = `${schema.exclusiveMaximum?"<":"<="}${schema.maximum}`
    }
    if (schema.multipleOf!==undefined){
      returnObj.constrain = `multiple of ${schema.multipleOf}`
    }
  }
  else if (schema.type==="string"){
    if (schema.minLength !==undefined  && schema.maxLength !==undefined ){
      returnObj.constrain = `${schema.minLength} to ${schema.maxLength} chars)`;
    }
    else if (schema.minLength!==undefined  && schema.maxLength===undefined ){
      returnObj.constrain = `min:${schema.minLength} chars`;
    }
    else if (schema.minLength===undefined  && schema.maxLength!==undefined ){
      returnObj.constrain = `max:${schema.maxLength} chars`;
    }
  }

  if (overrideAttributes){
    if (overrideAttributes.readOnly){
      returnObj.readOnly = 'read-only';
    }
    if (overrideAttributes.writeOnly){
      returnObj.writeOnly = 'write-only';
    }
    if (overrideAttributes.deprecated){
      returnObj.deprecated = 'depricated';
    }
  }

  // ${returnObj.readOnly}${returnObj.writeOnly}${returnObj.deprecated}\u00a0
  let html = `${returnObj.type}`;
  if (returnObj.allowedValues){
    html = html + `:(${returnObj.allowedValues})`;
  }
  if (returnObj.readOnly){
    html = html + `read-only`;
  }
  if (returnObj.writeOnly){
    html = html + `write-only`;
  }
  if (returnObj.deprecated){
    html = html + `depricated`;
  }

  if (returnObj.constrain){
    html = html + `\u00a0${returnObj.constrain}`;
  }
  if (returnObj.format){
    html = html + `\u00a0${returnObj.format}`;
  }
  if (returnObj.pattern){
    html = html + `\u00a0${returnObj.pattern}`;
  }
  returnObj.html = html;
  return returnObj;
}

/* For changing JSON-Schema to a Object Model that can be represnted in a tree-view */ 
export function schemaToModel (schema, obj) {
  if (schema==null){
    return;
  }
  if (schema.type==="object" || schema.properties){
    if (schema.description){
      obj[":description"] = schema.description;
    }
    for( let key in schema.properties ){
      obj[key] = schemaToModel(schema.properties[key],{});
    }
  }
  else if (schema.type==="array" || schema.items ){
    //let temp = Object.assign({}, schema.items );
    obj = [ schemaToModel(schema.items,{})  ]
  }
  else if (schema.allOf ){
    if (schema.allOf.length===1){
      if (!schema.allOf[0]){
        return `string~|~${schema.description?schema.description:''}`;
      }
      else{
        let overrideAttrib = { 
          "readOnly":schema.readOnly, 
          "writeOnly":schema.writeOnly, 
          "deprecated":schema.deprecated
        };
        return `${ getTypeInfo(schema.allOf[0],overrideAttrib).html }~|~${schema.description?schema.description:''}`
      }
    }

    // If allOf is an array of multiple elements, then they are the keys of an object
    let objWithAllProps = {};
    schema.allOf.map(function(v){
      if (v && v.properties){
        let partialObj = schemaToModel(v,{});
        Object.assign(objWithAllProps, partialObj);
      }
    });
    obj = objWithAllProps;
  }
  else{
    return `${getTypeInfo(schema).html}~|~${schema.description?schema.description:''}`;
  }
  return obj;
}

export function schemaToPdf (schema, obj=[], name) {
  if (schema==null){ return; }
  if (schema.type === "object" || schema.properties) {
    // Create a blank row for pdfMake to have the total count of columns
    let rows=[
      [{text:'', margin:0}, {text:'', margin:0}, {text:'', margin:0}]
    ];

    for( let key in schema.properties ){
      rows.push(schemaToPdf(schema.properties[key],[], key));
    }

    if (rows.length > 1){
      obj = [
        { 
          colSpan: 3,
          stack:[
            (name ? {
              text:[ 
                {text:name, style:['small', 'mono', 'blue']}, 
                {text:` {`, style:['small', 'mono', 'blue']},
              ],
            }
            :{text:`root { `, style:['small', 'mono', 'blue']}),
            {text:(schema.description ? schema.description : ''), style:['sub', 'blue'],margin:[0,2,0,0]},
            {
              margin: [10, 0, 0, 0],
              widths: [ 'auto', 'auto', '*' ],
              layout: rowLinesOnlyTableLayout,
              table: {
                dontBreakRows: true,
                body: rows
              },
            },
            {text:`}`, style:['small', 'mono', 'blue']}
          ]
        }
      ]
    }
    else{
      obj = [ 
        {text:name, style:['small', 'mono']},
        {text:(schema.type ? (schema.type + '{ }') :''), style:['small', 'mono']},
        {text:(schema.description?schema.description:''), style:['small']}
      ];
    }
  }
  
  else if (schema.type === "array") {
    let typeOfArr ='';
    let rows=[
      [{text:'', margin:0}, {text:'', margin:0}, {text:'', margin:0}]
    ];

    if (schema.items.properties){
      typeOfArr = "object";
      for( let key in schema.items.properties ){
        rows.push(schemaToPdf(schema.items.properties[key],[], key));
      }
    }
    else {
      typeOfArr = `${schema.items.type}` ? schema.items.type : 'allOf';
    }

    if (rows.length > 1){
      obj = [
        { 
          colSpan: 3,
          stack:[
            (name ? {
              text:[ 
                {text:name, style:['small', 'mono', 'blue']}, 
                {text:`${typeOfArr==='object'?'[{':'['}`, style:['small', 'mono', 'blue']},
              ],
              margin:0
            }
            :{text:`root [{`, style:['small', 'mono', 'blue'], margin:0}) ,
            {text:(schema.description ? schema.description : ''), style:['small'],margin:[0,2,0,0]},
            {
              margin: [10, 0, 0, 0],
              widths: [ 'auto', 'auto', '*' ],
              layout: rowLinesOnlyTableLayout,
              table: {
                dontBreakRows: true,
                body: rows
              }
            },
            {text:`${typeOfArr==='object'?'}]':']'}`, style:['small', 'mono', 'blue']}
          ]
        }
      ]
    }
    else{
      obj = [ 
        {text:name, style:['small', 'mono', 'blue'],margin:0},
        {
          text:[
            {text:'[', style:['small','mono','blue']} , 
            {text:`${typeOfArr}`, style:['small','mono']},
            {text:']', style:['small','mono','blue']} , 
          ]
          ,margin:0
        },
        {text:(schema.description?schema.description:''), style:['small'],margin:[0,2,0,0]}
      ];
    }

  }

  else if (schema.enum) {
    console.log("schema.enum");
    console.log(schema);
    let opt="[";
    schema.enum.map(function(v){
      opt = opt + `'${v}', `
    });
    opt = opt.slice(0, -2) + "]"
    obj = [
      {
        colSpan: 3,
        margin: [-4, 0, 0, 0],
        stack:[
          {
            margin: 0,
            widths: [ 'auto', 'auto', '*' ],
            layout: rowLinesOnlyTableLayout,
            defaultBorder: false,
            table: {
              dontBreakRows: true,
              body: [
                [
                  {
                    text:name, style:['small','mono']
                  },
                  {
                    text:'enum', style:['small','mono']
                  },
                  {
                  }
                ],
                [
                  {
                    text: ''
                  },
                  {
                    text: 'allowed:', style:['small','mono', 'boldTd'],
                  },
                  {
                    text:opt, style:['small', 'mono'], 
                  },
                ]
              ]
            },
          },
        ],
      }
    ];
    // obj = [
    //   {text:name + " enum", style:['small', 'mono', 'red'], margin:0},
    //   {text:(schema.type ? schema.type:''), style:['small', 'mono', 'orange'], margin:0},
    //   {text:(schema.description?schema.description:'foobar'), style:['small','purple'], margin:[0,2,0,0]}
    // ];
  }
  
  else {
    obj = [ 
      {text:name,style:['small', 'mono'],margin:0},
      {text:(schema.type ? schema.type:''), style:['small', 'mono'],margin:0},
      {text:(schema.description?schema.description:''), style:['small'],margin:[0,2,0,0]}
    ];
  }
  return obj;
}

export function getBaseUrlFromUrl(url){
    let pathArray = url.split( '/' );
    return pathArray[0] + "//" + pathArray[2];
}

export function removeCircularReferences(level=0) {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        //let dupVal = Object.assign({}, value);
        //return;
        if (level > 0){
          return {};
        }
        else{
          let dupVal = JSON.parse(JSON.stringify(value, removeCircularReferences(level+1)));
          seen.add(dupVal);
          return dupVal;
        }
        
      }
      seen.add(value);
    }
    return value;
  };
};
