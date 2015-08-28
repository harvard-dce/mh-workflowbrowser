

'use strict';

function create(){

	var rows = [[]];

	function rowCount(){
		return rows.length;
	}

	function stack(event){
    	var eventFits = true;
	    var eventRow  = -1;
	    if ( ! (event.dateStarted && event.dateCompleted )) {
	      // can't stack these guys.
	      return -1;
	    }
	    $.each(rows,function(rowI,rowEvents){
	      if (eventRow > -1){
	        return false;
	      }
	      eventFits = true;
	      $.each(rowEvents,function(eventI,e){
	        if ( e.dateStarted <= event.dateCompleted &&
	             e.dateCompleted >=  event.dateStarted ) {
	          eventFits = false;
	          return false;
	        }
	      });
	      if ( eventFits ) {
	        rowEvents.push(event);
	        eventRow = rowI;
	        return false;
	      }
	    });
	    if (eventFits ) {
	      return eventRow;
	    } else {
	      rows.push([]);
	      rows[rows.length-1].push(event);
	      return rows.length-1;
	    }
  }

	return {
		'stack': stack,
		'rowCount' : rowCount
	};
}


module.exports = { create: create};