const interactionTime = 100
const initTime = 400

describe('Extension Popup', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  describe('Initializing Phase', () => {
    it('successfully loads', () => {
      cy.get('#result-list').should('have.length', 1).find('#results-loading')
    })
    it('completes the initializing phase without errors', () => {
      cy.wait(initTime).get('#results-loading').should('not.exist').checkNoErrors()
    })
  })

  describe('Fuzzy search', () => {
    it('can execute a fuzzy search sucessfully', () => {
      cy.get('#search-input')
        .type(`JSON`)
        .wait(initTime)
        .get('#result-list')
        .should('not.have.length', 0)
        .get('[x-original-id=9]')
        .checkNoErrors()
    })
  })

  describe('Precise search', () => {
    it('can switch to precise search sucessfully', () => {
      cy.get('#search-approach-toggle')
        .wait(interactionTime)
        .contains('FUZZY')
        .click()
        .wait(interactionTime)
        .contains('PRECISE')
        .wait(initTime)
        .checkNoErrors()
    })

    it('can execute a fuzzy search sucessfully', () => {
      cy.get('#search-approach-toggle')
        .wait(interactionTime)
        .contains('FUZZY')
        .click()
        .wait(interactionTime)
        .contains('PRECISE')
        .wait(initTime)
        .get('#search-input')
        .type(`JSON`)
        .wait(initTime)
        .get('#result-list')
        .should('not.have.length', 0)
        .get('[x-original-id=9]')
        .checkNoErrors()
    })
  })
})
