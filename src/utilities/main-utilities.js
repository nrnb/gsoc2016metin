var options = require('./option-utilities').getOptions();
var elementUtilities = require('./element-utilities');

/*
 * The main utilities to be exposed directly.
 */
function mainUtilities() {
};

/*
 * Adds a new node with the given class and at the given coordinates. Considers undoable option.
 */
mainUtilities.addNode = function(x, y , nodeclass, id, parent, visibility) {
  if (!options.undoable) {
    return elementUtilities.addNode(x, y, nodeclass, id, parent, visibility);
  }
  else {
    var param = {
      newNode : {
        x: x,
        y: y,
        class: nodeclass,
        id: id,
        parent: parent,
        visibility: visibility
      }
    };
    
    cy.undoRedo().do("addNode", param);
  }
};

/*
 * Adds a new edge with the given class and having the given source and target ids. Considers undoable option.
 */
mainUtilities.addEdge = function(source, target , edgeclass, id, visibility) {
  // Get the validation result
  var validation = elementUtilities.validateArrowEnds(edgeclass, cy.getElementById(source), cy.getElementById(target));

  // If validation result is 'invalid' cancel the operation
  if (validation === 'invalid') {
    return;
  }
  
  // If validation result is 'reverse' reverse the source-target pair before creating the edge
  if (validation === 'reverse') {
    var temp = source;
    source = target;
    target = temp;
  }
      
  if (!options.undoable) {
    return elementUtilities.addEdge(source, target, edgeclass, id, visibility);
  }
  else {
    var param = {
      newEdge : {
        source: source,
        target: target,
        class: edgeclass,
        id: id,
        visibility: visibility
      }
    };
    
    cy.undoRedo().do("addEdge", param);
  }
};

/*
 * Adds a process with convenient edges. For more information please see 'https://github.com/iVis-at-Bilkent/newt/issues/9'.
 * Considers undoable option.
 */
mainUtilities.addProcessWithConvenientEdges = function(_source, _target, processType) {
  // If source and target IDs are given get the elements by IDs
  var source = typeof _source === 'string' ? cy.getElementById(_source) : _source;
  var target = typeof _target === 'string' ? cy.getElementById(_target) : _target;
  
  // If source or target does not have an EPN class the operation is not valid
  if (!elementUtilities.isEPNClass(source) || !elementUtilities.isEPNClass(target)) {
    return;
  }
  
  if (!options.undoable) {
    return elementUtilities.addProcessWithConvenientEdges(_source, _target, processType);
  }
  else {
    var param = {
      source: _source,
      target: _target,
      processType: processType
    };
    
    cy.undoRedo().do("addProcessWithConvenientEdges", param);
  }
};

/*
 * Clone given elements. Considers undoable option. Requires cytoscape-clipboard extension.
 */
mainUtilities.cloneElements = function (eles) {
  if (eles.length === 0) {
    return;
  }
  
  var cb = cy.clipboard();
  var _id = cb.copy(eles, "cloneOperation");

  if (options.undoable) {
    cy.undoRedo().do("paste", {id: _id});
  } 
  else {
    cb.paste(_id);
  }
};

/*
 * Copy given elements to clipboard. Requires cytoscape-clipboard extension.
 */
mainUtilities.copyElements = function (eles) {
  cy.clipboard().copy(eles);
};

/*
 * Past the elements copied to clipboard. Considers undoable option. Requires cytoscape-clipboard extension.
 */
mainUtilities.pasteElements = function() {
  if (options.undoable) {
    cy.undoRedo().do("paste");
  } 
  else {
    cy.clipboard().paste();
  }
};

/*
 * Aligns given nodes in given horizontal and vertical order. 
 * Horizontal and vertical parameters may be 'none' or undefined.
 * alignTo parameter indicates the leading node.
 * Requrires cytoscape-grid-guide extension and considers undoable option.
 */
mainUtilities.align = function (nodes, horizontal, vertical, alignTo) {
  if (nodes.length === 0) {
    return;
  }
  
  if (options.undoable) {
    cy.undoRedo().do("align", {
      nodes: nodes,
      horizontal: horizontal,
      vertical: vertical,
      alignTo: alignTo
    });
  } else {
    nodes.align(horizontal, vertical, alignTo);
  }
};

/*
 * Create compound for given nodes. compoundType may be 'complex' or 'compartment'.
 * This method considers undoable option.
 */
mainUtilities.createCompoundForGivenNodes = function (_nodes, compoundType) {
  var nodes = _nodes;
  // Just EPN's can be included in complexes so we need to filter EPN's if compound type is complex
  if (compoundType === 'complex') {
    nodes = _nodes.filter(function (i, element) {
      var sbgnclass = element.data("class");
      return elementUtilities.isEPNClass(sbgnclass);
    });
  }
  
  nodes = elementUtilities.getTopMostNodes(nodes);

  // All elements should have the same parent and the common parent should not be a 'complex' 
  // if compoundType is 'compartent'
  // because the old common parent will be the parent of the new compartment after this operation and
  // 'complexes' cannot include 'compartments'
  if (nodes.length == 0 || !elementUtilities.allHaveTheSameParent(nodes)
          || ( compoundType === 'compartment' && nodes.parent().data('class') === 'complex' ) ) {
    return;
  }
  
  if (cy.undoRedo()) {
    var param = {
      compoundType: compoundType,
      nodesToMakeCompound: nodes
    };

    cy.undoRedo().do("createCompoundForGivenNodes", param);
  }
  else {
    elementUtilities.createCompoundForGivenNodes(nodes, compoundType);
  }
};

/*
 * Move the nodes to a new parent and change their position if possDiff params are set.
 * Considers undoable option and checks if the operation is valid.
 */
mainUtilities.changeParent = function(nodes, _newParent, posDiffX, posDiffY) {
  var newParent = typeof _newParent === 'string' ? cy.getElementById(_newParent) : _newParent;
  if (newParent && newParent.data("class") != "complex" && newParent.data("class") != "compartment") {
    return;
  }

  if (newParent && newParent.data("class") == "complex") {
    nodes = nodes.filter(function (i, ele) {
      return elementUtilities.isEPNClass(ele.data("class"));
    });
  }

  nodes = nodes.filter(function (i, ele) {
    if (!newParent) {
      return ele.data('parent') != null;
    }
    return ele.data('parent') !== newParent.id();
  });

  if (newParent) {
    nodes = nodes.difference(newParent.ancestors());
  }

  if (nodes.length === 0) {
    return;
  }

  nodes = elementUtilities.getTopMostNodes(nodes);
  
  var parentId = newParent ? newParent.id() : null;
  
  if (options.undoable) {
    var param = {
      firstTime: true,
      parentData: parentId, // It keeps the newParentId (Just an id for each nodes for the first time)
      nodes: nodes,
      posDiffX: posDiffX,
      posDiffY: posDiffY
    };

    cy.undoRedo().do("changeParent", param); // This action is registered by undoRedo extension
  }
  else {
    elementUtilities.changeParent(nodes, parentId, posDiffX, posDiffY);
  }
};

/*
 * Creates a template reaction with given parameters. Requires cose-bilkent layout to tile the free macromolecules included
 * in the complex. Considers undoable option. For more information see the same function in elementUtilities
 */
mainUtilities.createTemplateReaction = function (templateType, macromoleculeList, complexName, processPosition, tilingPaddingVertical, tilingPaddingHorizontal, edgeLength) {
  if (!options.undoable) {
    elementUtilities.createTemplateReaction(templateType, macromoleculeList, complexName, processPosition, tilingPaddingVertical, tilingPaddingHorizontal, edgeLength);
  }
  else {
    var param = {
      templateType: templateType,
      macromoleculeList: macromoleculeList,
      complexName: complexName,
      processPosition: processPosition,
      tilingPaddingVertical: tilingPaddingVertical,
      tilingPaddingHorizontal: tilingPaddingHorizontal,
      edgeLength: edgeLength
    };
    
    cy.undoRedo().do("createTemplateReaction", param);
  }
};

/*
 * Resize given nodes if useAspectRatio is truthy one of width or height should not be set. 
 * Considers undoable option.
 */
mainUtilities.resizeNodes = function(nodes, width, height, useAspectRatio) {
  if (nodes.length === 0) {
    return;
  }
  
  if (options.undoable) {
    var param = {
      nodes: nodes,
      width: width,
      height: height,
      useAspectRatio: useAspectRatio,
      performOperation: true
    };
    
    cy.undoRedo().do("resizeNodes", param);
  }
  else {
    elementUtilities.resizeNodes(nodes, width, height, useAspectRatio);
  }
  
  cy.style().update();
};

/*
 * Changes the label of the given nodes to the given label. Considers undoable option.
 */
mainUtilities.changeNodeLabel = function(nodes, label) {
  if (nodes.length === 0) {
    return;
  }
  
  if (!options.undoable) {
    nodes.data('label', label);
  }
  else {
    var param = {
      nodes: nodes,
      label: label,
      firstTime: true
    };
    
    cy.undoRedo().do("changeNodeLabel", param);
  }
  
  cy.style().update();
};

/*
 * Change font properties for given nodes use the given font data.
 * Considers undoable option.
 */
mainUtilities.changeFontProperties = function(eles, data) {
  if (eles.length === 0) {
    return;
  }
  
  if (options.undoable) {
    var param = {
      eles: eles,
      data: data,
      firstTime: true
    };

    cy.undoRedo().do("changeFontProperties", param);
  }
  else {
    elementUtilities.changeFontProperties(eles, data);
  }
  
  cy.style().update();
};

/*
 * Change state value or unit of information box of given nodes with given index.
 * Considers undoable option.
 * For more information about the parameters see elementUtilities.changeStateOrInfoBox
 */
mainUtilities.changeStateOrInfoBox = function(nodes, index, value, type) {
  if (nodes.length === 0) {
    return;
  }
  if (options.undoable) {
    var param = {
      index: index,
      value: value,
      type: type,
      nodes: nodes
    };
    
    cy.undoRedo().do("changeStateOrInfoBox", param);
  }
  else {
    return elementUtilities.changeStateOrInfoBox(nodes, index, value, type);
  }
  
  cy.style().update();
};

// Add a new state or info box to given nodes.
// The box is represented by the parameter obj.
// Considers undoable option.
mainUtilities.addStateOrInfoBox = function(nodes, obj) {
  if (nodes.length === 0) {
    return;
  }
  
  if (!options.undoable) {
    elementUtilities.addStateOrInfoBox(nodes, obj);
  }
  else {
    var param = {
      obj: obj,
      nodes: nodes
    };
    
    cy.undoRedo().do("addStateOrInfoBox", param);
  }
  
  cy.style().update();
};

// Remove the state or info boxes of the given nodes at given index.
// Considers undoable option.
mainUtilities.removeStateOrInfoBox = function(nodes, index) {
  if (nodes.length === 0) {
    return;
  }
  
  if (!options.undoable) {
    elementUtilities.removeStateOrInfoBox(nodes, index);
  }
  else {
    var param = {
      index: index,
      nodes: nodes
    };

    cy.undoRedo().do("removeStateOrInfoBox", param);
  }
  
  cy.style().update();
};

/*
 * Set multimer status of the given nodes to the given status.
 * Considers undoable option.
 */
mainUtilities.setMultimerStatus = function(nodes, status) {
  if (nodes.length === 0) {
    return;
  }
  
  if (options.undoable) {
    var param = {
      status: status,
      nodes: nodes,
      firstTime: true
    };

    cy.undoRedo().do("setMultimerStatus", param);
  }
  else {
    elementUtilities.setMultimerStatus(nodes, status);
  }
  
  cy.style().update();
};

/*
 * Set clone marker status of given nodes to the given status.
 * Considers undoable option.
 */ 
mainUtilities.setCloneMarkerStatus = function(nodes, status) {
  if (nodes.length === 0) {
    return;
  }
  
  if (options.undoable) {
    var param = {
      status: status,
      nodes: nodes,
      firstTime: true
    };

    cy.undoRedo().do("setCloneMarkerStatus", param);
  }
  else {
    elementUtilities.setCloneMarkerStatus(nodes, status);
  }
  
  cy.style().update();
};

/*
 * Change style/css of given eles by setting getting property name to the given given value/values (Note that valueMap parameter may be
 * a single string or an id to value map). Considers undoable option.
 */
mainUtilities.changeCss = function(eles, name, valueMap) {
  if (eles.length === 0) {
    return;
  }
  
  if (!options.undoable) {
    elementUtilities.changeCss(eles, name, valueMap);
  }
  else {
    var param = {
      eles: eles,
      valueMap: valueMap,
      name: name
    };
    
    cy.undoRedo().do("changeCss", param);
  }
  
  cy.style().update();
};

/*
 * Change data of given eles by setting getting property name to the given given value/values (Note that valueMap parameter may be
 * a single string or an id to value map). Considers undoable option.
 */
mainUtilities.changeData = function(eles, name, valueMap) {
  if (eles.length === 0) {
    return;
  }
  
  if (!options.undoable) {
    elementUtilities.changeData(eles, name, valueMap);
  }
  else {
    var param = {
      eles: eles,
      valueMap: valueMap,
      name: name
    };
    
    cy.undoRedo().do("changeData", param);
  }
  
  cy.style().update();
};

/*
 * Unhide given eles (the ones which are hidden if any) and perform given layout afterward. Layout parameter may be layout options
 * or a function to call. Requires viewUtilities extension and considers undoable option.
 */
mainUtilities.showAndPerformLayout = function(eles, layoutparam) {
  var hiddenEles = eles.filter(':hidden');
  if (hiddenEles.length === 0) {
    return;
  }
  
  if (!options.undoable) {
    elementUtilities.showAndPerformLayout(hiddenEles, layoutparam);
  }
  else {
    var param = {
      eles: hiddenEles,
      layoutparam: layoutparam,
      firstTime: true
    };
    
    cy.undoRedo().do("showAndPerformLayout", param);
  }
};

module.exports = mainUtilities;