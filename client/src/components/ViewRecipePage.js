import React from "react";
import "../styles/modal.css";
import AppMode from "../AppMode.js";

class ViewRecipePage extends React.Component {
  constructor(props) {
    super(props);
    //confirmDelete state variable determines whether to show or hide the
    //confirm delete dialog box
    this.state = this.props.data;
    this.state.confirmDelete = false;
    this.state.viewMode = true;
  }

  // Handles the general changes to an input box
  handleChange = (event) => {
    const name = event.target.name;
    this.setState({ [name]: event.target.value });
  };

  // confirms the decision to delete a recipe
  confirmDelete = () => {
    this.setState({ confirmDelete: true });
  };

  // performs the delete
  doDelete = () => {
    this.props.deleteRecipe(this.props.id);
    this.setState({ confirmDelete: false });
  };

  //cancelDelete -- Triggered when the user chooses to cancel a delete
  //operation. We just need to update state to toggle confirmDelete to false
  cancelDelete = () => {
    this.setState({ confirmDelete: false });
  };

  //Update the favorited field in database
  favoriteClicked = () => {
    var newData = this.state;
    if (this.state.favorited) {
      this.setState({ favorited: false });
      newData.favorited = false;
    } else {
      this.setState({ favorited: true });
      newData.favorited = true;
    }

    delete newData.confirmDelete;
    this.props.saveRecipe(newData, this.props.id, AppMode.RECIPES_VIEWRECIPE);
  };

  // Lets the page know if we are viewing or editing a recipe
  changeToEditMode = (e) => {
    if (this.state.viewMode) {
      this.setState({ viewMode: false });
    }
    // if we were in edit mode, but are going back
    // to view mode, we will want to save any changes
    else {
      let recipeData = this.state;
      delete recipeData.confirmDelete;
      delete recipeData.viewMode;

      // NOTE: A random empty obj was being added. Don't remove this.
      delete recipeData[""];
      setTimeout(this.props.saveRecipe, 1000, recipeData);
      e.preventDefault();
      this.setState({ viewMode: true });
    }
  };

  // Generates the dialog to confirm deleting a recipe
  renderConfirmDeleteDialog = () => {
    return (
      <div className="modal" role="dialog">
        <div className="modal-content">
          <div className="modal-header">
            <p className="modal-title">Confirm Recipe Deletion</p>
            <button className="close-modal-button" onClick={this.cancelDelete}>
              &times;
            </button>
          </div>
          <div className="modal-body">
            <center>
              <h4>Are you sure that you want to delete this recipe?</h4>
            </center>
            <div className="modal-footer">
              <button
                className="loginBtn btn confirm-delete-btn"
                onClick={this.doDelete}
              >
                YES
              </button>
              <button
                className="loginBtn btn confirm-delete-btn"
                onClick={this.cancelDelete}
              >
                NO
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // changes the source to a default image if the provided recipe image is not found
  renderRecipeImageError = (e) =>{
    e.target.src = 'https://www.boilersupplies.com/img/no_image.png'
  }

  // renders the image for a recipe on the page
  renderRecipeImage = () => {
    return (
      <img
        src={this.state.pictureURL}
        height="200"
        style={{ float: "left" }}
        // ensures something shows even if the image is not
        // found
        alt="No Image Found"
        onError={this.renderRecipeImageError}
      />
    );
  };

  // Adds a direction to the recipe (blank)
  addDirection(e) {
    e.preventDefault();
    this.setState({ directions: [...this.state.directions, ""] });
  }

  // Adds an ingredient to the recipe (blank)
  addIngredient(e) {
    e.preventDefault();
    let ingredientObj = {};
    ingredientObj.name = "";
    ingredientObj.quantity = 0;
    ingredientObj.unit = "";
    this.setState({
      ingredients: [...this.state.ingredients, ingredientObj],
    });
  }

  // renders the ingredient list in view mode
  renderIngredients = () => {
    let ingredients = [];
    //if the data are ingredients objects
    for (let i = 0; i < this.state.ingredients.length; ++i) {
      ingredients.push(
        <tr key={i}>
          <td>{this.state.ingredients[i].name}</td>
          <td>
            {this.state.ingredients[i].quantity}{" "}
            {this.state.ingredients[i].unit.toLowerCase() == 'whole' ? 
              null :
              (this.state.ingredients[i].quantity > 1 ?
                this.state.ingredients[i].unit + "s" :
                this.state.ingredients[i].unit)}
          </td>
          {this.state.ingredients[i].pictureURL && (
            <td>
              <img
                src={this.state.ingredients[i].pictureURL}
                height="40"
                width="40"
              />
            </td>
          )}
        </tr>
      );
    }

    return ingredients;
  };

  // handles the change to ingredient name
  handleChangeIngredientName(e, index) {
    this.state.ingredients[index].name = e.target.value;
    this.setState({ ingredients: this.state.ingredients });
  }

  // handles the change to ingredient quantity
  handleChangeIngredientQuantity(e, index) {
    this.state.ingredients[index].quantity = parseFloat(e.target.value);
    this.setState({ ingredients: this.state.ingredients });
  }

  // handles the change to ingredient unit
  handleChangeIngredientUnit(e, index) {
    this.state.ingredients[index].unit = e.target.value;
    this.setState({ ingredients: this.state.ingredients });
  }

  // render the ingredients in edit mode with inputs
  renderIngredientsEditMode = () => {
    let ingredients = [];
    //if the data are ingredients objects
    for (let i = 0; i < this.state.ingredients.length; ++i) {
      ingredients.push(
        <tr key={i}>
          <td className="view-name-grouping">
            {" "}
            <input
              className="ingredient-input-name-edit form-control"
              onChange={(e) => this.handleChangeIngredientName(e, i)}
              value={this.state.ingredients[i].name}
              placeholder="Ingredient Name"
            />
            <input
              type="number"
              className="form-control ingredient-input-quantity-edit"
              onChange={(e) => this.handleChangeIngredientQuantity(e, i)}
              value={this.state.ingredients[i].quantity}
              placeholder="Ingredient Quantity"
              step="0.01"
              min="0"
            />
            <input
              className="form-control ingredient-input-unit-edit"
              list="units"
              onChange={(e) => this.handleChangeIngredientUnit(e, i)}
              value={this.state.ingredients[i].unit}
              placeholder="Ingredient Unit"
            />            
            <datalist id="units">
                          <option>whole</option>
                          <option>teaspoon</option>
                          <option>tablespoon</option>
                          <option>cup</option>
                          <option>gallon</option>
                          <option>pound</option>
                          <options>ounce</options>
                          <options>quart</options>
                          <options>pint</options>
                        </datalist>
          </td>
          {this.state.ingredients[i].pictureURL && (
            <td>
              <img
                src={this.state.ingredients[i].pictureURL}
                height="40"
                width="40"
              />
            </td>
          )}
          <td className="x-table-col">
            <button
              className="loginBtn btn"
              onClick={(e) => this.handleRemoveIngredient(e, i)}
            >
              X
            </button>
          </td>
        </tr>
      );
    }

    return ingredients;
  };

  // removes a direction and changes the numbers to match
  handleRemoveDirection(e, index) {
    e.preventDefault();
    this.state.directions.splice(index, 1);
    this.setState({ directions: this.state.directions });
  }

  // removes an ingredient from the recipe
  handleRemoveIngredient(e, index) {
    e.preventDefault();
    this.state.ingredients.splice(index, 1);
    this.setState({ ingredients: this.state.ingredients });
  }

  // renders the directions in view mode
  renderDirections = () => {
    let directions = [];
    for (let i = 0; i < this.state.directions.length; ++i) {
      directions.push(
        <tr key={i}>
          <td>{i + 1}</td>
          <td>{this.state.directions[i]}</td>
        </tr>
      );
    }
    return directions;
  };

  // handes a change to a direction input
  handleChangeDirection(e, index) {
    this.state.directions[index] = e.target.value;
    this.setState({ directions: this.state.directions });
  }

  // renders the directions as inputs for edit mode
  renderDirectionsEditMode = () => {
    let directions = [];
    for (let i = 0; i < this.state.directions.length; ++i) {
      directions.push(
        <tr key={i}>
          <td>{i + 1}</td>
          <td>
            {" "}
            <div>
              <textarea
                className="form-control direction-textarea-edit"
                onChange={(e) => this.handleChangeDirection(e, i)}
                value={this.state.directions[i]}
              />
            </div>
          </td>
          <td className="x-table-col">
            <button
              className="loginBtn btn"
              style={{height:"5%"}}
              onClick={(e) => this.handleRemoveDirection(e, i)}
            >
              X
            </button>
          </td>
        </tr>
      );
    }
    return directions;
  };

  render() {
    return (
      <div className="paddedPage">
        <div className="recipeContent">
          <div>
            {this.state.pictureURL ? this.renderRecipeImage() : null}
            <div className="recipeContentTitleInfo">
              <div>
                {/* conditionally renders the name of the recipe based on mode */}
                <h1 className="view-name-grouping">
                  {this.state.viewMode ? (
                    <p>{this.state.name} </p>
                  ) : (
                    <label htmlFor="name">
                      <input
                        value={this.state.name}
                        name="name"
                        id="name"
                        className="name-edit-input form-control"
                        type="text"
                        required
                        onChange={this.handleChange}
                      />
                    </label>
                  )}
                  <span
                    className={
                      "fav-btn fa fa-star " +
                      (this.state.favorited ? "favorited" : "unfavorited")
                    }
                    onClick={this.favoriteClicked}
                  ></span>
                </h1>
              </div>
              <h3 className="recipeContentTitleInfoSubInfo">
                Added: {this.state.dateAdded}
              </h3>
              <h3 className="recipeContentTitleInfoSubInfo">
                {/* conditionally renders the cook time of the recipe based on mode */}
                {this.state.viewMode ? (
                  <p>Cook Time: {this.state.cookTime} minutes</p>
                ) : (
                  <label htmlFor="cookTime">
                    Cook Time:
                    <input
                      name="cookTime"
                      id="cookTime"
                      type="text"
                      value={this.state.cookTime}
                      className="cooktime-edit-input form-control input-style"
                      required
                      onChange={this.handleChange}
                    />
                    minutes
                  </label>
                )}
              </h3>
              {/* If we are in edit mode, we want to allow re-entering a new url */}
              {!this.state.viewMode && (
                <label htmlFor="pictureURL">
                  Picture URL:
                  <input
                    name="pictureURL"
                    id="pictureURL"
                    type="text"
                    className="picture-url-input form-control input-style"
                    value={this.state.pictureURL}
                    onChange={this.handleChange}
                  />
                </label>
              )}
            </div>
            <div className="view-recipe-btn-family">
              <div>
                {/* toggles the edit/save button depending on mode */}
                <span
                  className={
                    this.state.viewMode
                      ? "view-recipe-btn view-recipe-btn-edit fa fa-edit"
                      : "view-recipe-btn view-recipe-btn-edit fa fa-save"
                  }
                  onClick={(e) => this.changeToEditMode(e)}
                ></span>
              </div>
              <div>
                <span
                  className="view-recipe-btn fa fa-trash"
                  onClick={this.confirmDelete}
                ></span>
              </div>
            </div>
          </div>
          <div className="recipeContentListInfo">
            <h4>
              Ingredients{" "}
            </h4>
            <table className="table table-hover ingredientsTable">
              <tbody>
                {this.state.viewMode
                  ? this.renderIngredients()
                  : this.renderIngredientsEditMode()}
              </tbody>
            </table>
            <h4>
              <center>
              {!this.state.viewMode && (
                <button
                  className="addBtn"
                  onClick={(e) => this.addIngredient(e)}
                >
                  <span className="fa fa-plus"></span>
                </button>
              )}
              </center>   
            </h4>

            <h4>
              Directions{" "}
            </h4>
            <table className="table table-hover directionsTable">
              <tbody>
                {this.state.viewMode
                  ? this.renderDirections()
                  : this.renderDirectionsEditMode()}
              </tbody>
            </table>
            <h4>  
              <center>         
            {!this.state.viewMode && (
                <button
                  className="addBtn"
                  onClick={(e) => this.addDirection(e)}
                >
                  <span className="fa fa-plus"></span>
                </button>
              )}   
              </center>            
            </h4>
          </div>

          {this.state.confirmDelete ? this.renderConfirmDeleteDialog() : null}
        </div>
      </div>
    );
  }
}

export default ViewRecipePage;
