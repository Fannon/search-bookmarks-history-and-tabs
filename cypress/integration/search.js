const interactionTime = 100
const initTime = 400

describe('Search View', () => {
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

  describe('Result Navigation', () => {
    it('first result is highlighted', () => {
      cy.get('#search-input')
        .type(`JSON Edit`)
        .get('#result-list li')
        .each((el, index) => {
          console.log(el)
          if (index === 0) {
            expect(el[0].id).to.equal('selected-result')
          } else {
            expect(el[0].id).to.not.equal('selected-result')
          }
        })
        .get('#search-input')
        .type('{downarrow}')
        .get('#result-list li')
        .each((el, index) => {
          if (index === 1) {
            expect(el[0].id).to.equal('selected-result')
          } else {
            expect(el[0].id).to.not.equal('selected-result')
          }
        })
        .get('#search-input')
        .type('{uparrow}')
        .get('#result-list li')
        .each((el, index) => {
          if (index === 0) {
            expect(el[0].id).to.equal('selected-result')
          } else {
            expect(el[0].id).to.not.equal('selected-result')
          }
        })
    })
  })

  describe('Fuzzy search', () => {
    it('can execute a fuzzy search sucessfully', () => {
      cy.get('#search-input')
        .type(`JSON`)
        .wait(initTime)
        // Make sure we get result of all types
        .get('#result-list')
        .should('not.have.length', 0)
        .find('[x-original-id=9]')
        .get('#result-list')
        .find('li.bookmark')
        .get('#result-list')
        .find('li.history')
        .get('#result-list')
        .find('li.tab')
        .get('#result-list')
        .find('li.search')
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
        // Make sure we get result of all types
        .get('#result-list')
        .should('not.have.length', 0)
        .find('[x-original-id=9]')
        .get('#result-list')
        .find('li.bookmark')
        .get('#result-list')
        .find('li.history')
        .get('#result-list')
        .find('li.tab')
        .get('#result-list')
        .find('li.search')
        .checkNoErrors()
    })
  })

  describe('Bookmark search', () => {
    it('Empty search returns recent bookmarks', () => {
      cy.get('#search-input')
        .type(`b `)
        .get('#result-list')
        .find('li.bookmark')
        .get('#result-list')
        .find('[x-original-id=9]')
        .get('.tab')
        .should('not.exist')
        .get('.history')
        .should('not.exist')
        .checkNoErrors()
    })
    it('returns only bookmark results', () => {
      cy.get('#search-input')
        .type(`b JSON`)
        .get('#result-list')
        .find('[x-original-id=9]')
        .get('.tab')
        .should('not.exist')
        .get('.history')
        .should('not.exist')
        .checkNoErrors()
    })
  })

  describe('History search', () => {
    it('Empty search returns recent history', () => {
      cy.get('#search-input')
        .type(`h `)
        .get('#result-list')
        .find('li.history')
        .get('#result-list')
        .find('[x-original-id=9]')
        .get('.tab')
        .should('not.exist')
        .get('.bookmark')
        .should('not.exist')
        .checkNoErrors()
    })
    it('only the history result', () => {
      cy.get('#search-input')
        .type(`h JSON`)
        .get('#result-list')
        .find('[x-original-id=9]')
        .get('.tab')
        .should('not.exist')
        .get('.bookmark')
        .should('not.exist')
        .checkNoErrors()
    })
  })

  describe('Tab search', () => {
    it('Empty search returns all open tabs', () => {
      cy.get('#search-input')
        .type(`t `)
        .get('#result-list')
        .find('li.tab')
        .get('#result-list')
        .find('[x-original-id=179]')
        .get('.bookmark')
        .should('not.exist')
        .get('.history')
        .should('not.exist')
        .checkNoErrors()
    })
    it('returns only the tab results', () => {
      cy.get('#search-input')
        .type(`t JSON`)
        .get('#result-list')
        .find('[x-original-id=185]')
        .get('#result-list')
        .should('have.length', 1)
        .get('.bookmark')
        .should('not.exist')
        .get('.history')
        .should('not.exist')
        .checkNoErrors()
    })
  })
})
