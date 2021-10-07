var options = {
 
    /** Set these values based on the desired attributes for the new application */
    target_scope: "x_gur_appraisal", // Should begin with x_gur_ to be consistent with GR's assigned scope id.
    target_app_name: "Rate - Appraisal",  // Should begin with "Rate - " to help easly distinguish these apps from SN or 3rd party apps in the SNOW application picker.
    target_module_name: "Appraisal", // This is the display name that appears in the menu navigation menu.
    target_task_table: "task", // The suffix portion of the primary task table's system name.  Should be Singular and should NOT include the target scope.  The generated name will automatically prepend the scope.  E.G. x_gur_origination_task
    target_task_table_name: "Appraisal Task", // The display name of the primary task table.  Should be Singular 
    target_number_prefix: "APR", // The numbering prefix for the primary task table.  

	/** name of update set file that should be used */
    source_update_set_file: 'GR Task-Based Template.xml',

    /** Do not change - this is the scope assigned by ServiceNow to GuaranteedRate.*/
    company_scope: "x_gur",

    /** Do not change these settings, unless the template itself changes */
    source_scope: "x_gur_grt",
    source_app_name: "GR Template",
    source_module_name: "GR Template Module",
    source_task_table: "task",
    source_task_table_name: "GR Task",
    source_number_prefix: "GRT",
}

run();


function run() {

    //pre-validations
    if (options.target_scope.length > 18) {
        throw new Error("Scope cannot be more than 18 characters in length");
    }

    if (options.target_app_name.length > 100) {
        throw new Error("Name cannot be more than 100 characters in length");
    }

    if (options.target_scope.indexOf(options.company_scope + "_") != 0) {
        throw new Error("The target scope name must start with " + options.company_scope + "_");
    }

    if (options.target_app_name.indexOf("Rate - ") != 0) {
        throw new Error("The target app name name must start with 'Rate - `");
    }


    var fs = require('fs');


    fs.readFile(options.source_update_set_file, 'utf8', function (err, data) {
        if (err) throw err;

        var updateSet = { data: data };


        var updateSetName = `${options.target_app_name} Custom Application`;

        // perform string replacements.  Use RegExp if there are multiple replacements needed.

        // Change the Sys IDs to match the target app.
        replaceSysIds(updateSet);

        // replace number prefix (also look for GRC2)        
		console.log("updating numbering prefix from " + options.source_number_prefix + " to " + options.target_number_prefix);
        updateSet.data = updateSet.data.replace(`<prefix>${options.source_number_prefix}</prefix>`, `<prefix>${options.target_number_prefix}</prefix>`)
        updateSet.data = updateSet.data.replace(`<prefix>GRC2</prefix>`, `<prefix>${options.target_number_prefix}</prefix>`)

        // replace update set name (perform only first  replacement)
        updateSet.data = updateSet.data.replace(`<name>${options.source_app_name}</name>`, `<name>${updateSetName}</name>`)

        //replace table names before replacing the scope, to ensure only appropriate replacements are made.
        replaceTables(updateSet);

        // Change the App record name before replacing the scope, to ensure only appropriate replacements are made.
        changeAppName(updateSet);

        // Substitute the scope prefix
        substituteScopePrefix(updateSet);

        // Replace CreatedBy/UpdateBy, CreatedOn/UpdatedOn
        replaceAuditFields(updateSet);


        fs.writeFile(`${updateSetName}.xml`, updateSet.data, function () {
            console.log("clone is complete");
        });

    });

}

function substituteScopePrefix(updateSet) {
	console.log("updating scope prefix from " + options.source_scope + " to " + options.target_scope);
    var regExp = new RegExp(options.source_scope, "gm");
    updateSet.data = updateSet.data.replace(regExp, options.target_scope);
}

function replaceTables(updateSet) {

	var sourceTableName = options.source_scope + "_" + options.source_task_table;
	var targetTableName = options.target_scope + "_" + options.target_task_table;

    // replace table system name
	console.log("updating table name from " + sourceTableName + " to " + targetTableName);
    var regExp = new RegExp(sourceTableName, "gm");
    updateSet.data = updateSet.data.replace(regExp, targetTableName);

    // replace table display name
	console.log("updating table display name from " + options.source_task_table_name + " to " + options.target_task_table_name);
    regExp = new RegExp(options.source_task_table_name, "gm");
    updateSet.data = updateSet.data.replace(regExp, options.target_task_table_name);
}

function changeAppName(updateSet) {

    var re;

    //updating module name
	console.log("updating module name from " + options.source_module_name + " to " + options.target_module_name);
    re = new RegExp(options.source_module_name, "gm");
    updateSet.data = updateSet.data.replace(re, options.target_module_name);

    //updating app name display value
	console.log("updating app display name from " + options.source_app_name + " to " + options.target_app_name);
    re = new RegExp(`application display_value="${options.source_app_name}"`, "gm");
    updateSet.data = updateSet.data.replace(re, `application display_value="${options.target_app_name}"`);
    
    re = new RegExp(`<name>${options.source_app_name}</name>`, "gm");
    updateSet.data = updateSet.data.replace(re, `<name>${options.target_app_name}</name>`);

    //updating app name throughout
    re = new RegExp(options.source_app_name, "gm");
    updateSet.data = updateSet.data.replace(re, options.target_app_name);

    // //updating other names
    // regExp = new RegExp(options.source_task_table, "gm");
    // updateSet.data = updateSet.data.replace(/GR Tasks/gm, options.task_plural);
    // updateSet.data = updateSet.data.replace(/GR Task/gm, options.task_singular);
    // updateSet.data = updateSet.data.replace(/x_gur_grt_task/gm, options.target_scope + "_" + options.target_task_table);
    // updateSet.data = updateSet.data.replace(/gr_task/gm, options.target_task_table);

}

function replaceSysIds(updateSet) {

    var sysIdMap = {};
    var excludeSysIds = [
        "e0355b31ef303000a61d5a3615c0fb78"
    ]

    var guids = getDefinedGuids(updateSet.data); // get guid (any format)
    var totalIds = 0;
    for (const guid of guids) {
        totalIds++;
        var normalizedGuid = guid.replace(/-/g, "");
        if (excludeSysIds.indexOf(normalizedGuid) == -1) {
            if (!sysIdMap.hasOwnProperty(normalizedGuid)) {
                sysIdMap[guid] = newGuid();
            }
        }
    }

    var uniqueIds = 0;
    for (prop in sysIdMap) {
        uniqueIds++;
        var normalizedSourceGuid = prop;
        var hyphenatedSourceGuid = require("add-dashes-to-uuid")(normalizedSourceGuid);
        var normalizedTargetGuid = sysIdMap[prop];
        var hyphenatedTargetGuid = require("add-dashes-to-uuid")(normalizedTargetGuid);

        console.log("replacing " + normalizedSourceGuid + " with " + normalizedTargetGuid);
        updateSet.data = updateSet.data.replace(new RegExp(normalizedSourceGuid, "gm"), normalizedTargetGuid);
        updateSet.data = updateSet.data.replace(new RegExp(hyphenatedSourceGuid.replace(/\-/g, "\-"), "gm"), hyphenatedTargetGuid);
    }

    //console.log("total ids: " + totalIds);
    //console.log("unique ids: " + uniqueIds);

}

function replaceAuditFields(updateSet) {
   // todo: not that important, but would be ideal to replace these with current values.
}


/** Get guids for records that are defined in this update set.  do no replace referenced guids. */
function getDefinedGuids(text) {

	//<sys_id>28302808fd79b44be7246e66010cd998</sys_id>
    //var re = />([0-9a-fA-F]{32})<\/sys_id>/gim;
    var re = /(>|&gt;)([0-9a-fA-F]{32})(<|&lt;)\/sys_id(>|&gt;)/gim;


//    var re = /[0-9a-fA-F]{32}/gim;
    //var re = /insert/gim;
	var guids = [];
    var matches = text.matchAll(re);
	for (const match of matches) {
		var guid = match[2];
		guids.push(guid);
	}
	return guids;
}

function newGuid() {
    var guid = require("guid");
    return guid.create().value.replace(/\-/g, "");
}