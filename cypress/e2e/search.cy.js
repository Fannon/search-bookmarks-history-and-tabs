const interactionTime = 500
const initTime = 500

describe('Search View', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  describe('Initializing Phase', () => {
    it('successfully loads', () => {
      cy.get('#result-list').should('have.length', 1).find('#results-loading')
    })
    it('completes the initializing phase without errors', () => {
      cy.get('#results-loading').should('not.exist').checkNoErrors()
    })
    it('starts with no results', () => {
      cy.get('#result-counter').contains('(0)')
    })
  })

  describe('Result Navigation', () => {
    it('first result is highlighted', () => {
      cy.get('#search-input')
        .type(`JSON Edit`)
      cy.get('#result-list li')
        .each((el, index) => {
          if (index === 0) {
            expect(el[0].id).to.equal('selected-result')
          } else {
            expect(el[0].id).to.not.equal('selected-result')
          }
        })
      cy.get('#search-input')
        .type('{downarrow}')
      cy.get('#result-list li')
        .each((el, index) => {
          if (index === 1) {
            expect(el[0].id).to.equal('selected-result')
          } else {
            expect(el[0].id).to.not.equal('selected-result')
          }
        })
      cy.get('#search-input')
        .type('{uparrow}')
      cy.get('#result-list li')
        .each((el, index) => {
          if (index === 0) {
            expect(el[0].id).to.equal('selected-result')
          } else {
            expect(el[0].id).to.not.equal('selected-result')
          }
        })
        .checkNoErrors()
    })
  })

  describe('Search result item', () => {
    it('includes everything expected (title, URL etc.)', () => {
      cy.get('#search-input')
        .type(`JSON`)
      cy.get('#result-list')
        .find('[x-original-id=9]')

        // Check that we have a result with a title returned
      cy.get('[x-original-id=9]')
        .find('.title')
        .contains('JSON')

        // Check that we have a result with an URL returned
      cy.get('[x-original-id=9]')
        .find('.url')
        .contains('json')

        // expect #json tag
      cy.get('[x-original-id=9]')
        .find('span.tags')
        .contains('#json')

        // expect ~Tools folder
      cy.get('[x-original-id=9]')
        .find('span.folder')
        .contains('~Tools')

        // expect lastVisited badge
      cy.get('[x-original-id=9]')
        .find('span.last-visited')

        // expect score badge
      cy.get('[x-original-id=9]')
        .find('span.score')

        .checkNoErrors()
    })
  })

  describe('Precise search', () => {
    it('can execute a precise search successfully', () => {
      cy.get('#search-approach-toggle')
      cy.get('#search-input')
        .type(`JSON`)
        .wait(initTime)
        // Make sure we get result of all types
      cy.get('#result-list')
        .should('not.have.length', 0)
        .find('[x-original-id=9]')
      cy.get('#result-list')
        .find('li.bookmark')
      cy.get('#result-list')
        .find('li.history')
      cy.get('#result-list')
        .find('li.tab')
      cy.get('#result-list')
        .find('li.bookmark')
        .checkNoErrors()
    })
    it('can execute a precise search with non-ASCII chars successfully', () => {
      cy.get('#search-approach-toggle')
      cy.get('#search-input')
        .type(`äe指事字₽`)
        .wait(initTime)
        // Only make sure that search doesn't crash
      cy.get('#result-list')
        .should('not.have.length', 0)
        .checkNoErrors()
    })
  })

  describe('Fuzzy search', () => {
    it('can switch to fuzzy search successfully', () => {
      cy.get('#search-approach-toggle')
        .wait(interactionTime)
        .contains('PRECISE')
        .click()
        .wait(interactionTime)
        .contains('FUZZY')
      cy.get('#search-input')
        .type(`JSON`)
      cy.get('li.bookmark')
        .checkNoErrors()
    })

    it('can execute a fuzzy search successfully', () => {
      cy.get('#search-approach-toggle')
        .wait(interactionTime)
        .contains('PRECISE')
        .click()
        .wait(interactionTime)
        .contains('FUZZY')
        .wait(interactionTime)
      cy.get('#search-input')
        .type(`JSON`)
      cy.get('li.bookmark')
      cy.get('#result-list')
        .should('not.have.length', 0)
        .find('[x-original-id=9]')
        // Check that we have all kinds of results
      cy.get('#result-list')
        .find('li.bookmark')
      cy.get('#result-list')
        .find('li.history')
      cy.get('#result-list')
        .find('li.tab')
      cy.get('#result-list')
        .find('li.bookmark')
        .checkNoErrors()
    })
  })

  it('can execute a precise search with non-ASCII chars successfully', () => {
    cy.get('#search-approach-toggle')
      .wait(interactionTime)
      .contains('PRECISE')
      .click()
      .wait(interactionTime)
      .contains('FUZZY')
      .wait(interactionTime)
    cy.get('#search-input')
      .type(`äe指事字₽`)
      .wait(initTime)
      // Only make sure that search doesn't crash
    cy.get('#result-list')
      .should('not.have.length', 0)
      .checkNoErrors()
  })

  describe('Bookmark search', () => {
    it('Empty search returns recent bookmarks', () => {
      cy.get('#search-input')
        .type(`b `)
      cy.get('#result-list')
        .find('li.bookmark')
      cy.get('#result-list')
        .find('[x-original-id=9]')
      cy.get('.tab')
        .should('not.exist')
      cy.get('.history')
        .should('not.exist')
        .checkNoErrors()
    })
    it('returns only bookmark results', () => {
      cy.get('#search-input')
        .type(`b JSON`)
      cy.get('#result-list')
        .find('[x-original-id=9]')
      cy.get('.tab')
        .should('not.exist')
      cy.get('.history')
        .should('not.exist')
      cy.get('#result-counter')
        .contains('(5)')
        .checkNoErrors()
    })
  })

  describe('History search', () => {
    it('Empty search returns recent history', () => {
      cy.get('#search-input')
        .type(`h `)
      cy.get('#result-list')
        .find('li.history')
      cy.get('#result-list')
        .find('[x-original-id=9]')
      cy.get('.tab')
        .should('not.exist')
      cy.get('.bookmark')
        .should('not.exist')
        .checkNoErrors()
    })
    it('only the history results', () => {
      cy.get('#search-input')
        .type(`h JSON`)
      cy.get('#result-list')
        .find('[x-original-id=9]')
      cy.get('.tab')
        .should('not.exist')
      cy.get('.bookmark')
        .should('not.exist')
      cy.get('#result-counter')
        .contains('(3)')
        .checkNoErrors()
    })
  })

  describe('Tab search', () => {
    it('Empty search returns all open tabs', () => {
      cy.get('#search-input')
        .type(`t `)
      cy.get('#result-list')
        .find('li.tab')
      cy.get('#result-list')
        .find('[x-original-id=179]')
      cy.get('.bookmark')
        .should('not.exist')
      cy.get('.history')
        .should('not.exist')
        .checkNoErrors()
    })
    it('returns only the tab results', () => {
      cy.get('#search-input')
        .type(`t JSON`)
      cy.get('#result-list')
        .find('[x-original-id=185]')
      cy.get('#result-list')
        .should('have.length', 1)
      cy.get('.bookmark')
        .should('not.exist')
      cy.get('.history')
        .should('not.exist')
      cy.get('#result-counter')
        .contains('(1)')
        .checkNoErrors()
    })
  })
})
